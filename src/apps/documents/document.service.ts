import path from 'node:path';
import { db } from '@/database';
import { DocumentKind, DocumentStatus, type Document } from '@/database/generated/prisma/client';

import { documentChunkRepository } from './document-chunk.repository';
import { invalidateDocumentCaches } from './document.cache';
import { toDocumentView } from './document.mapper';
import { documentRepository } from './document.repository';
import { detectDocumentType } from './document-type.detector';
import type { ListDocumentsQuery } from './document.schema';
import { QueueName } from '@/services/queue/job.payload';
import { enqueueJob } from '@/services/queue';
import { logger } from '@/libs/logger';
import { AuthenticatedUser } from '@/types/express';
import { BadRequestError, NotFoundError, ServiceUnavailableError } from '@/libs/errors';
import { computeChecksum } from '@/utils/checksum';
import { TIER_LIMITS } from '@/config/tier-limits';
import { StoredFile } from '@/services/storage/storage-provider.interface';
import { fileStorage } from '@/services/storage/storage.factory';
import { env } from '@/config/env';
import { cachePolicies } from '@/cache/cache.policies';
import { Cache, hashKeyPart } from '@/cache/cache.service';

interface PendingUpload {
  originalName: string;
  buffer: Buffer;
  checksum: string;
  kind: DocumentKind;
  mimeType: string;
}

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === 'P2002';

async function queueIngestion(document: Document) {
  try {
    await enqueueJob(QueueName.DocumentIngestion, 'process-document', {
      documentId: document.id,
      userId: document.userId,
    });
    return document;
  } catch (error) {
    logger.error('Could not queue document ingestion', {
      documentId: document.id,
      error: (error as Error).message,
    });
    return documentRepository.updateDocument(document.id, {
      status: DocumentStatus.FAILED,
      failureReason: 'Processing could not be queued. Please retry.',
    });
  }
}

export const documentService = {
  async uploadDocuments(user: AuthenticatedUser, files: Express.Multer.File[]) {
    if (files.length === 0) {
      throw new BadRequestError(
        'No files received. Send multipart/form-data with the "files" field.',
      );
    }

    const duplicates: Document[] = [];
    const pending: PendingUpload[] = [];
    const seenChecksums = new Set<string>();

    for (const file of files) {
      const checksum = computeChecksum(file.buffer);
      if (seenChecksums.has(checksum)) continue;
      seenChecksums.add(checksum);
      // #TODO: Consider using a transaction to avoid race conditions where two requests upload the same file at the same time.
      const existing = await documentRepository.getDocumentByChecksum(user.id, checksum);
      if (existing) {
        duplicates.push(existing);
        continue;
      }

      const detected = await detectDocumentType(file.buffer, file.originalname);
      pending.push({
        originalName: path.basename(file.originalname).slice(0, 255),
        buffer: file.buffer,
        checksum,
        ...detected,
      });
    }

    const limit = TIER_LIMITS[user.tier].maxDocuments;
    const current = await documentRepository.countActiveDocuments(user.id);
    if (current + pending.length > limit) {
      throw new QuotaExceededError(`Your ${user.tier} plan allows up to ${limit} documents`, {
        limit,
        current,
      });
    }

    const stored: StoredFile[] = await fileStorage.uploadMany(
      pending.map((item) => ({
        namespace: `${env.NODE_ENV}/${user.id}/docs`,
        originalName: item.originalName,
        contentType: item.mimeType,
        body: item.buffer,
      })),
    );

    const created: Document[] = [];
    for (const [index, item] of pending.entries()) {
      const storedFile = stored[index]!;
      try {
        let document = await documentRepository.createDocument({
          userId: user.id,
          originalName: item.originalName,
          kind: item.kind,
          mimeType: item.mimeType,
          sizeBytes: storedFile.sizeBytes,
          checksum: item.checksum,
          storageProvider: storedFile.provider,
          storageKey: storedFile.key,
          status: DocumentStatus.UPLOADED,
          processedAt: null,
        });
        document = await queueIngestion(document);
        created.push(document);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // A concurrent request stored the same file first.
        const existing = await documentRepository.getDocumentByChecksum(user.id, item.checksum);
        if (existing) duplicates.push(existing);
      }
    }

    await invalidateDocumentCaches(user.id);
    logger.info('Documents uploaded', {
      userId: user.id,
      created: created.length,
      duplicates: duplicates.length,
    });

    return { documents: created.map(toDocumentView), duplicates: duplicates.map(toDocumentView) };
  },

  async listDocuments(userId: string, query: ListDocumentsQuery) {
    const policy = cachePolicies.documentList;
    return Cache.getOrSet(
      policy.key(userId, hashKeyPart(query)),
      { ttlSeconds: policy.ttlSeconds, tags: policy.tags(userId) },
      async () => {
        const { items, total } = await documentRepository.listDocuments({ userId, ...query });
        return {
          documents: items.map(toDocumentView),
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
        };
      },
    );
  },

  async getDocument(userId: string, documentId: string) {
    const policy = cachePolicies.documentDetail;
    const document = await Cache.getOrSet(
      policy.key(documentId),
      { ttlSeconds: policy.ttlSeconds, tags: policy.tags(documentId) },
      async () => {
        const found = await documentRepository.getDocumentById(documentId, userId);
        if (!found) throw new NotFoundError('Document not found');
        return { ...toDocumentView(found), ownerId: found.userId };
      },
    );
    if (document.ownerId !== userId) throw new NotFoundError('Document not found');
    const { ownerId: _ownerId, ...view } = document;
    return view;
  },

  async getDownloadUrl(userId: string, documentId: string) {
    const document = await documentRepository.getDocumentById(documentId, userId);
    if (!document) throw new NotFoundError('Document not found');
    if (document.storageProvider !== fileStorage.name) {
      throw new ServiceUnavailableError(
        'This document is stored with a different storage provider',
      );
    }
    const expiresInSeconds = 600;
    const url = await fileStorage.getFileUrl(document.storageKey, {
      expiresInSeconds,
      downloadName: document.originalName,
    });
    return { url, expiresInSeconds };
  },

  async reprocessDocument(userId: string, documentId: string) {
    const document = await documentRepository.getDocumentById(documentId, userId);
    if (!document) throw new NotFoundError('Document not found');
    if (document.status !== DocumentStatus.FAILED) {
      throw new BadRequestError('Only failed documents can be reprocessed');
    }
    const reset = await documentRepository.updateDocument(documentId, {
      status: DocumentStatus.UPLOADED,
      failureReason: null,
    });
    const queued = await queueIngestion(reset);
    await invalidateDocumentCaches(userId, documentId);
    return toDocumentView(queued);
  },

  /** Removes the user's content: chunks and stored file are deleted, the row is soft-deleted. */
  async deleteDocument(userId: string, documentId: string) {
    const deleted = await db.$transaction(async (tx) => {
      const document = await documentRepository.softDeleteDocument(documentId, userId, tx);
      if (!document) throw new NotFoundError('Document not found');
      await documentChunkRepository.deleteChunksForDocument(documentId, tx);
      return document;
    });

    try {
      if (!(await documentRepository.hasActiveDocumentWithStorageKey(deleted.storageKey))) {
        await fileStorage.deleteFile(deleted.storageKey);
      }
    } catch (error) {
      logger.error('Stored file removal failed', { documentId, error: (error as Error).message });
    }

    await invalidateDocumentCaches(userId, documentId);
    logger.info('Document deleted', { userId, documentId });
  },
};
