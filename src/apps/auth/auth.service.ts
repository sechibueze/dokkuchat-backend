import { randomUUID } from 'node:crypto';
import { env } from '@/config/env';
import { db, type Tx } from '@/database';
import { userRepository } from '@/apps/users/user.repository';
import { tokenService } from '@/apps/auth/token.service';
import { passwordService } from '@/apps/auth/password.service';
import { logger } from '@/libs/logger';
import {
  type RegisterUserInput,
  type LoginInput,
  type ResetPasswordInput,
} from '@/apps/auth/auth.schema';
import { UnauthorizedError, ConflictError, BadRequestError } from '@/libs/errors';
import { toPublicUser } from '@/apps/users/user.mapper';
import type { User } from '@/database/generated/prisma/client';
import { accessTokenRepository } from './access-token.repository';
import { rbacRepository } from '../rbac/rbac.repository';
export interface ClientContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

const REFRESH_TOKEN_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000;

const invalidCredentials = () => new UnauthorizedError('Invalid email or password');

function isUniqueConstraintViolation(err: unknown) {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

async function issueAuthTokens(
  userId: string,
  client: ClientContext,
  tx: Tx = db,
): Promise<AuthTokens> {
  const { token: refreshToken, tokenHash } = tokenService.generateOpaqueToken();

  await accessTokenRepository.createAccessToken(
    {
      userId,
      type: 'bearer',
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgent: client.userAgent,
      ipAddress: client.ipAddress,
    },
    tx,
  );

  return {
    accessToken: await tokenService.signAccessToken(userId),
    refreshToken,
    tokenType: 'Bearer',
    expiresInSeconds: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  };
}

export const authService = {
  async register(input: RegisterUserInput, client: ClientContext) {
    if (await userRepository.getUserByEmail(input.email)) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await passwordService.hash(input.password);

    try {
      const { user, auth } = await db.$transaction(async (tx) => {
        const userRole = await rbacRepository.getDefaultRole();
        const created = await userRepository.createUser(
          {
            name: input.name,
            email: input.email,
            password: passwordHash,
            roleName: userRole?.name,
          },
          tx,
        );

        const accessTokens = await issueAuthTokens(created.id, client, tx);
        return { user: created, auth: accessTokens };
      });

      logger.info('User registered', { userId: user.id });
      return { user: toPublicUser(user), ...auth };
    } catch (err) {
      // Two simultaneous registrations can both pass the check above.
      if (isUniqueConstraintViolation(err)) {
        throw new ConflictError('An account with this email already exists');
      }
      throw err;
    }
  },

  async login(input: LoginInput, client: ClientContext) {
    const user = await userRepository.getUserByEmail(input.email);

    if (!user) {
      throw invalidCredentials();
    }

    if (!(await passwordService.verify(user.password, input.password))) {
      logger.warn('Failed login attempt', { userId: user.id });
      throw invalidCredentials();
    }

    const tokens = await issueAuthTokens(user.id, client);
    logger.info('User logged in', { userId: user.id, name: user.name });
    return { user: { id: user.id, name: user.name }, ...tokens };
  },

  async refreshAccessToken(refreshToken: string, client: ClientContext): Promise<AuthTokens> {
    const tokenHash = tokenService.hashToken(refreshToken);

    // Outcomes are returned, not thrown: throwing inside the transaction would roll back
    // the family revocation that reuse detection depends on.
    const outcome = await db.$transaction(async (tx) => {
      const stored = await accessTokenRepository.getAccessTokenByHash(tokenHash, tx);
      if (!stored) return { kind: 'invalid' } as const;

      if (stored.revokedAt) {
        await accessTokenRepository.revokeAccessTokenFamily(stored.type, tx);
        return { kind: 'reuse-detected', userId: stored.userId } as const;
      }
      if (stored.expiresAt <= new Date()) return { kind: 'invalid' } as const;

      const claimed = await accessTokenRepository.revokeIfActive(stored.id, tx);
      if (!claimed) {
        await accessTokenRepository.revokeAccessTokenFamily(stored.type, tx);
        return { kind: 'reuse-detected', userId: stored.userId } as const;
      }

      const user = await userRepository.getUserById(stored.userId, {}, tx);
      if (!user) return { kind: 'invalid' } as const;

      const tokens = await issueAuthTokens(user.id, client, tx);
      return { kind: 'rotated', tokens } as const;
    });

    if (outcome.kind === 'reuse-detected') {
      logger.warn('Refresh token reuse detected; session family revoked', {
        userId: outcome.userId,
      });
    }
    if (outcome.kind !== 'rotated') throw new UnauthorizedError('Session is no longer valid');

    return outcome.tokens;
  },

  async logout(refreshToken: string) {
    const stored = await accessTokenRepository.getAccessTokenByHash(
      tokenService.hashToken(refreshToken),
    );
    if (stored) await accessTokenRepository.revokeAccessTokenFamily(stored.type);
  },

  async logoutAllSessions(userId: string) {
    await accessTokenRepository.revokeAllForUser(userId);
  },

  /** Always resolves the same way so the endpoint cannot be used to discover registered emails. */
  async forgotPassword(email: string) {
    const user = await userRepository.getUserByEmail(email);
    if (!user) return;

    const { token, tokenHash } = tokenService.generateOpaqueToken();

    await db.$transaction(async (tx) => {
      await accessTokenRepository.invalidateActiveTokenFamilyForUser(user.id, 'password_reset', tx);
      await accessTokenRepository.createAccessToken(
        {
          userId: user.id,
          type: 'password_reset',
          tokenHash,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
        tx,
      );
    });

    logger.info('Password reset requested', { userId: user.id });
  },

  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = tokenService.hashToken(input.token);
    const newPasswordHash = await passwordService.hash(input.newPassword);

    const wasReset = await db.$transaction(async (tx) => {
      const stored = await accessTokenRepository.getAccessTokenByHash(tokenHash, tx);
      if (!stored) return false;
      if (!(await accessTokenRepository.revokeIfActive(stored.id, tx))) return false;

      const user = await userRepository.getUserById(stored.userId, {}, tx);
      if (!user) return false;

      await userRepository.updateUser(user.id, { password: newPasswordHash }, tx);
      await accessTokenRepository.revokeAllForUser(user.id, tx);
      return true;
    });

    if (!wasReset) throw new BadRequestError('This reset link is invalid or has expired');
    logger.info('Password reset completed');
  },
};
