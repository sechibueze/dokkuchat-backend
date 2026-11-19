import { db, type Tx } from '@/database';
import type { Prisma } from '@/database/generated/prisma/client';

const active = { deletedAt: null } as const;

export const conversationRepository = {
  createConversation(data: { userId: string; title: string; documentIds: string[] }, tx: Tx = db) {
    return tx.conversation.create({ data });
  },

  getConversationById(id: string, userId: string, tx: Tx = db) {
    return tx.conversation.findFirst({ where: { id, userId, ...active } });
  },

  async listConversations(params: { userId: string; page: number; limit: number }, tx: Tx = db) {
    const where: Prisma.ConversationWhereInput = { userId: params.userId, ...active };
    const [items, total] = await Promise.all([
      tx.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      tx.conversation.count({ where }),
    ]);
    return { items, total };
  },

  /** Bumps updatedAt so the list stays ordered by recent activity. */
  touchConversation(id: string, data: { title?: string } = {}, tx: Tx = db) {
    return tx.conversation.update({ where: { id }, data: { updatedAt: new Date(), ...data } });
  },

  async softDeleteConversation(id: string, userId: string, tx: Tx = db) {
    const { count } = await tx.conversation.updateMany({
      where: { id, userId, ...active },
      data: { deletedAt: new Date() },
    });
    return count > 0;
  },
};
