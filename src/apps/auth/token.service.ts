import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { env } from '@/config/env';
import { UnauthorizedError } from '@/libs/errors';

const signingKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export const tokenService = {
  signAccessToken(userId: string) {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(env.JWT_ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
      .sign(signingKey);
  },

  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    try {
      const { payload } = await jwtVerify(token, signingKey, {
        issuer: env.JWT_ISSUER,
        algorithms: ['HS256'],
      });
      if (!payload.sub) throw new UnauthorizedError('Token has no subject');
      return { userId: payload.sub };
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  },

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  },

  /** Random secret handed to the client; only its hash is stored. */
  generateOpaqueToken() {
    const token = randomBytes(48).toString('base64url');
    return { token, tokenHash: tokenService.hashToken(token) };
  },
};
