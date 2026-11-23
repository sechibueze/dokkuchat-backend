import { db, type Tx } from '@/database';
import type { Prisma, ToolApprovalStatus } from '@/database/generated/prisma/client';

export const toolApprovalRepository = {
  createManyAndReturn(data: Prisma.ToolApprovalCreateManyInput[], tx: Tx = db) {
    return tx.toolApproval.createManyAndReturn({ data });
  },
  getByIdForUser(id: string, userId: string, tx: Tx = db) {
    return tx.toolApproval.findFirst({ where: { id, userId, deletedAt: null } });
  },
  listForUser(params: { userId: string; status?: ToolApprovalStatus }, tx: Tx = db) {
    return tx.toolApproval.findMany({
      where: {
        userId: params.userId,
        deletedAt: null,
        ...(params.status && { status: params.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },
  listByMessage(messageId: string, tx: Tx = db) {
    return tx.toolApproval.findMany({ where: { messageId }, orderBy: { createdAt: 'asc' } });
  },
  async claimDecision(id: string, status: ToolApprovalStatus, userId?: string, tx: Tx = db) {
    const { count } = await tx.toolApproval.updateMany({
      where: { id, status: 'PENDING', ...(userId && { userId }) },
      data: { status, decidedAt: new Date() },
    });
    return count === 1;
  },
  countPending(messageId: string, tx: Tx = db) {
    return tx.toolApproval.count({ where: { messageId, status: 'PENDING' } });
  },
  listStalePending(now: Date, limit: number, tx: Tx = db) {
    return tx.toolApproval.findMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      take: limit,
    });
  },
  saveOutcome(id: string, outcome: { result?: string; error?: string }, tx: Tx = db) {
    return tx.toolApproval.update({ where: { id }, data: outcome });
  },
};
