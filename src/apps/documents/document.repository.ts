import { db, type Tx } from '@/database';
import type { DocumentStatus, Prisma } from '@/database/generated/prisma/client';

export interface ListDocumentsFilter {
  userId: string;
  page: number;
  limit: number;
  status?: DocumentStatus;
}

const active = { deletedAt: null } as const;

export const documentRepository = {
  createDocument(data: Prisma.DocumentUncheckedCreateInput, tx: Tx = db) {
    return tx.document.create({ data });
  },

  getDocumentById(id: string, userId: string, tx: Tx = db) {
    return tx.document.findFirst({ where: { id, userId, ...active } });
  },

  /** For workers: no owner filter, and soft-deleted rows are returned so the worker can skip them. */
  getDocumentForProcessing(id: string, tx: Tx = db) {
    return tx.document.findUnique({ where: { id } });
  },

  getDocumentByChecksum(userId: string, checksum: string, tx: Tx = db) {
    return tx.document.findFirst({ where: { userId, checksum, ...active } });
  },

  countActiveDocuments(userId: string, tx: Tx = db) {
    return tx.document.count({ where: { userId, ...active } });
  },

  countOwnedDocuments(userId: string, ids: string[], tx: Tx = db) {
    return tx.document.count({ where: { userId, id: { in: ids }, ...active } });
  },

  async hasActiveDocumentWithStorageKey(storageKey: string, tx: Tx = db) {
    return (await tx.document.count({ where: { storageKey, ...active } })) > 0;
  },

  async listDocuments({ userId, page, limit, status }: ListDocumentsFilter, tx: Tx = db) {
    const where: Prisma.DocumentWhereInput = { userId, ...active, ...(status && { status }) };
    const [items, total] = await Promise.all([
      tx.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      tx.document.count({ where }),
    ]);
    return { items, total };
  },

  updateDocument(id: string, data: Prisma.DocumentUncheckedUpdateInput, tx: Tx = db) {
    return tx.document.update({ where: { id }, data });
  },

  async softDeleteDocument(id: string, userId: string, tx: Tx = db) {
    const document = await tx.document.findFirst({ where: { id, userId, ...active } });
    if (!document) return null;
    return tx.document.update({
      where: { id },
      data: { deletedAt: new Date(), checksum: `deleted:${Date.now()}:${document.checksum}` },
    });
  },
};
