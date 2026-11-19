import { db, type Tx } from '@/database';

export interface CreateAccessTokenData {
  userId: string;
  type: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export const accessTokenRepository = {
  createAccessToken(data: CreateAccessTokenData, tx: Tx = db) {
    return tx.accessToken.create({ data });
  },

  getAccessTokenByHash(tokenHash: string, tx: Tx = db) {
    return tx.accessToken.findUnique({ where: { tokenHash } });
  },

  /** Atomic claim: returns false if another request already revoked this token. */
  async revokeIfActive(id: string, tx: Tx = db): Promise<boolean> {
    const { count } = await tx.accessToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count === 1;
  },

  async revokeAccessTokenFamily(type: string, tx: Tx = db) {
    await tx.accessToken.updateMany({
      where: { type, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async revokeAllForUser(userId: string, tx: Tx = db) {
    await tx.accessToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async invalidateActiveTokenFamilyForUser(userId: string, type: string, tx: Tx = db) {
    await tx.accessToken.updateMany({
      where: { userId, type, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async deleteExpiredTokens(cutoff: Date, tx: Tx = db) {
    const { count } = await tx.accessToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
    });
    return count;
  },
};
