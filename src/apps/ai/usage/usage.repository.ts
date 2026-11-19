import { db, type Tx } from '@/database';
import type { UsageKind } from '@/database/generated/prisma/client';

export interface CreateUsageLogData {
  userId: string;
  kind: UsageKind;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  documentId?: string;
  conversationId?: string;
  correlationId?: string;
}

export const usageRepository = {
  createUsageLog(data: CreateUsageLogData, tx: Tx = db) {
    return tx.usageLog.create({ data });
  },

  async getUsageSince(userId: string, since: Date, tx: Tx = db) {
    const result = await tx.usageLog.aggregate({
      where: { userId, createdAt: { gte: since }, deletedAt: null },
      _sum: { totalTokens: true, costUsd: true },
      _count: true,
    });
    return {
      totalTokens: result._sum.totalTokens ?? 0,
      costUsd: result._sum.costUsd?.toNumber() ?? 0,
      requests: result._count,
    };
  },
};
