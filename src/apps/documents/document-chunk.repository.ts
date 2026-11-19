import { db, type Tx } from '@/database';
import { Prisma } from '@/database/generated/prisma/client';
import type { TextChunk } from './ingestion/text-chunker';
import { toPgVector } from '@/utils/vector';

export interface PendingChunk {
  id: string;
  content: string;
}

export const documentChunkRepository = {
  /** Idempotent: a retried ingestion replaces whatever a failed attempt left behind. */
  async replaceChunks(
    params: { documentId: string; userId: string; chunks: TextChunk[] },
    tx: Tx = db,
  ) {
    const { documentId, userId, chunks } = params;
    await tx.documentChunk.deleteMany({ where: { documentId } });
    await tx.documentChunk.createMany({
      data: chunks.map((chunk) => ({
        documentId,
        userId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        characterCount: chunk.content.length,
        pageNumber: chunk.pageNumber,
      })),
    });
  },

  /** `embedding` is an Unsupported column, so Prisma cannot filter on it: raw SQL. */
  listChunksPendingEmbedding(documentId: string, limit: number, tx: Tx = db) {
    return tx.$queryRaw<PendingChunk[]>(Prisma.sql`
      SELECT id, content FROM document_chunks
      WHERE "documentId" = ${documentId}::uuid AND embedding IS NULL AND "deletedAt" IS NULL
      ORDER BY "chunkIndex" LIMIT ${limit}`);
  },

  async saveEmbeddings(
    items: { id: string; embedding: number[] }[],
    embeddingModel: string,
    tx: Tx = db,
  ) {
    if (items.length === 0) return;
    const ids = items.map((item) => item.id);
    const vectors = items.map((item) => toPgVector(item.embedding));

    const updated = await tx.$executeRaw`
      UPDATE document_chunks AS chunk
      SET embedding = incoming.embedding::vector, "embeddingModel" = ${embeddingModel}, "updatedAt" = now()
      FROM unnest(${ids}::uuid[], ${vectors}::text[]) AS incoming(id, embedding)
      WHERE chunk.id = incoming.id`;
    if (updated !== items.length) {
      throw new Error(`Expected to update ${items.length} chunk embeddings, updated ${updated}`);
    }
  },

  deleteChunksForDocument(documentId: string, tx: Tx = db) {
    return tx.documentChunk.deleteMany({ where: { documentId } });
  },
};
