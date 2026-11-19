import { db, type Tx } from '@/database';
import { Prisma } from '@/database/generated/prisma/client';
import type { TextChunk } from './ingestion/text-chunker';
import { toPgVector } from '@/utils/vector';

export interface PendingChunk {
  id: string;
  content: string;
}

export interface SimilarChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  similarity: number;
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

  searchSimilarChunks(
    params: {
      userId: string;
      embedding: number[];
      embeddingModel: string;
      limit: number;
      documentIds?: string[];
    },
    tx: Tx = db,
  ) {
    const vector = toPgVector(params.embedding);
    const scope = params.documentIds?.length
      ? Prisma.sql`AND c."documentId" = ANY(${params.documentIds}::uuid[])`
      : Prisma.empty;

    return tx.$queryRaw<SimilarChunk[]>(Prisma.sql`
    SELECT c.id AS "chunkId", c."documentId", d."originalName" AS "documentName",
           c."chunkIndex", c."pageNumber", c.content,
           1 - (c.embedding <=> ${vector}::vector) AS similarity
    FROM document_chunks c
    JOIN documents d ON d.id = c."documentId"
    WHERE c."userId" = ${params.userId}::uuid
      AND c."embeddingModel" = ${params.embeddingModel}
      AND c.embedding IS NOT NULL
      AND c."deletedAt" IS NULL AND d."deletedAt" IS NULL
      ${scope}
    ORDER BY c.embedding <=> ${vector}::vector
    LIMIT ${params.limit}`);
  },
};
