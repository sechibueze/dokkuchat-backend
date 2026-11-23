import { db, type Tx } from '@/database';
import type { MessageRole, MessageStatus, Prisma } from '@/database/generated/prisma/client';

export interface CreateMessageData {
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  status?: MessageStatus;
  agentState?: Prisma.InputJsonValue;
  citations?: Prisma.InputJsonValue;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
}

export const messageRepository = {
  createMessage(data: CreateMessageData, tx: Tx = db) {
    return tx.message.create({ data });
  },

  async getRecentMessages(conversationId: string, limit: number, tx: Tx = db) {
    const rows = await tx.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.reverse();
  },

  async listMessages(params: { conversationId: string; page: number; limit: number }, tx: Tx = db) {
    const where = { conversationId: params.conversationId, deletedAt: null };
    const [items, total] = await Promise.all([
      tx.message.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      tx.message.count({ where }),
    ]);
    return { items, total };
  },

  getMessageById(id: string, tx: Tx = db) {
    return tx.message.findUnique({ where: { id } });
  },

  async claimAwaitingMessage(id: string, tx: Tx = db) {
    const { count } = await tx.message.updateMany({
      where: { id, status: 'AWAITING_APPROVAL' },
      data: { status: 'COMPLETED' },
    });
    return count === 1 ? tx.message.findUnique({ where: { id } }) : null;
  },
  completeMessage(
    id: string,
    data: { content: string; model?: string; promptTokens?: number; completionTokens?: number },
    tx: Tx = db,
  ) {
    return tx.message.update({ where: { id }, data: { ...data, agentState: Prisma.DbNull } });
  },
};
