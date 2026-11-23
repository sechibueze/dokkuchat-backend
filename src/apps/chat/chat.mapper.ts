import { SimilarChunk } from '../documents/document-chunk.repository';
import type { Message } from '@/database/generated/prisma/client';

export interface Citation {
  sourceNumber: number;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number;
  snippet: string;
}

export const toCitations = (chunks: SimilarChunk[]): Citation[] =>
  chunks.map((chunk, index) => ({
    sourceNumber: index + 1,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    similarity: Math.round(chunk.similarity * 1000) / 1000,
    snippet: chunk.content.slice(0, 240),
  }));

export const toMessageView = (message: Message) => ({
  id: message.id,
  role: message.role,
  content: message.content,
  status: message.status,
  citations: message.citations ?? [],
  model: message.model,
  createdAt: message.createdAt,
});
