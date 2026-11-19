import type { Document } from '../../database/generated/prisma/client';

export type DocumentView = Pick<
  Document,
  | 'id'
  | 'originalName'
  | 'kind'
  | 'mimeType'
  | 'sizeBytes'
  | 'status'
  | 'failureReason'
  | 'pageCount'
  | 'chunkCount'
  | 'createdAt'
  | 'processedAt'
>;

export const toDocumentView = (document: Document): DocumentView => ({
  id: document.id,
  originalName: document.originalName,
  kind: document.kind,
  mimeType: document.mimeType,
  sizeBytes: document.sizeBytes,
  status: document.status,
  failureReason: document.failureReason,
  pageCount: document.pageCount,
  chunkCount: document.chunkCount,
  createdAt: document.createdAt,
  processedAt: document.processedAt,
});
