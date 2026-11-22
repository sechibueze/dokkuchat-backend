import type { UpdateProfileInput } from './user.schema';
import { toPublicUser } from './user.mapper';
import { userRepository } from './user.repository';
import { NotFoundError } from '@/libs/errors';
import { db } from '@/database';
import { accessTokenRepository } from '../auth/access-token.repository';
import { logger } from '@/libs/logger';
import { AuthenticatedUser } from '@/types/express';
import { cachePolicies } from '@/cache/cache.policies';
import { Cache } from '@/cache/cache.service';

export const userService = {
  async getProfile(userId: string) {
    const user = await userRepository.getUserById(userId);
    if (!user) throw new NotFoundError('User not found');
    return toPublicUser(user);
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const existing = await userRepository.getUserById(userId);
    if (!existing) throw new NotFoundError('User not found');

    const updated = await userRepository.updateUser(userId, { name: input.name });
    await userService.invalidateUserCache(userId);
    return toPublicUser(updated);
  },

  /** Soft delete: frees the email address and signs the user out everywhere, atomically. */
  async deleteAccount(userId: string) {
    await db.$transaction(async (tx) => {
      if (!(await userRepository.softDeleteUser(userId, tx))) {
        throw new NotFoundError('User not found');
      }
      await accessTokenRepository.revokeAllForUser(userId, tx);
    });

    await userService.invalidateUserCache(userId);
    logger.info('User soft deleted', { userId });
  },

  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
    const policy = cachePolicies.authenticatedUser;
    const cached = await Cache.get<AuthenticatedUser>(policy.key(userId));
    if (cached) return cached;

    const user = await userRepository.getUserForAuthentication(userId);
    if (!user) return null;

    const authenticated: AuthenticatedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      tier: user.tier,
      role: user.role.name,
      roleId: user.roleId,
      permissions: user.role.permissions.map((p) => p.permission.key),
    };
    await Cache.set(policy.key(userId), authenticated, {
      ttlSeconds: policy.ttlSeconds,
      tags: policy.tags(userId),
    });
    return authenticated;
  },

  invalidateUserCache(userId: string) {
    return Cache.invalidateTags(...cachePolicies.authenticatedUser.tags(userId));
  },
};
