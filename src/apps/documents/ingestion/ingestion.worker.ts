import { UnrecoverableError } from 'bullmq';
import { db } from '@/database';
import { DocumentStatus, type Prisma } from '@/database/generated/prisma/client';
import { documentRepository } from '../document.repository';
import { documentChunkRepository } from '../document-chunk.repository';
import { fileStorage } from '@/services/storage/storage.factory';
import { embeddingService } from '@/apps/ai/embeddings/embedding.service';
import { logger } from '@/libs/logger';
import { enqueueJob } from '@/services/queue';
import { invalidateDocumentCaches } from '../document.cache';
import { chunkPages } from './text-chunker';
import { getTextExtractor } from './text-extractor';
import { DocumentIngestionJob } from '@/services/queue/job.payload';
import { appEvents } from '@/events';
import { WorkerDefinition } from '@/services/queue/worker';
import { QueueName } from '@/services/queue/job.payload';

const EMBEDDING_BATCH_SIZE = 32;

async function setDocumentState(
  documentId: string,
  userId: string,
  data: Prisma.DocumentUncheckedUpdateInput,
) {
  await documentRepository.updateDocument(documentId, data);
  await invalidateDocumentCaches(userId, documentId);
}

async function processDocument({ documentId, userId }: DocumentIngestionJob) {
  const document = await documentRepository.getDocumentForProcessing(documentId);
  if (!document || document.deletedAt) {
    logger.warn('Skipping ingestion: document missing or deleted', { documentId });
    return;
  }

  await setDocumentState(documentId, userId, {
    status: DocumentStatus.PROCESSING,
    failureReason: null,
  });

  const extractor = getTextExtractor(document.kind);
  if (!extractor) {
    logger.info('No text extractor for document kind', { documentId, kind: document.kind });
    return;
  }

  const file = await fileStorage.downloadFile(document.storageKey);
  const { pages } = await extractor.extract(file);
  const chunks = chunkPages(pages);
  if (chunks.length === 0) {
    throw new UnrecoverableError(
      'No extractable text found. The file may be a scan or an image-only PDF.',
    );
  }

  await db.$transaction(async (tx) => {
    await documentChunkRepository.replaceChunks({ documentId, userId, chunks }, tx);
    await documentRepository.updateDocument(
      documentId,
      { status: DocumentStatus.EMBEDDING, pageCount: pages.length, chunkCount: chunks.length },
      tx,
    );
  });
  await invalidateDocumentCaches(userId, documentId);

  await enqueueJob(QueueName.DocumentIngestion, 'embed-document', { documentId, userId });
  logger.info('Document chunked', { documentId, pages: pages.length, chunks: chunks.length });
}

async function embedDocument(
  { documentId, userId }: DocumentIngestionJob,
  jobProgress: (percent: number) => Promise<void>,
) {
  const document = await documentRepository.getDocumentForProcessing(documentId);
  if (!document || document.deletedAt) return;

  // guards against a stuck loop
  const maxBatches = Math.ceil(document.chunkCount / EMBEDDING_BATCH_SIZE) + 2;
  let embedded = 0;

  //   @TODO: Consider using a cursor-based approach to avoid potential race conditions with other workers.
  for (let batch = 0; batch < maxBatches; batch++) {
    const pending = await documentChunkRepository.listChunksPendingEmbedding(
      documentId,
      EMBEDDING_BATCH_SIZE,
    );
    if (pending.length === 0) break;

    await embeddingService.embedAndStoreChunks({ userId, documentId, chunks: pending });
    embedded += pending.length;
    await jobProgress(
      Math.min(100, Math.round((embedded / Math.max(1, document.chunkCount)) * 100)),
    );
  }

  await setDocumentState(documentId, userId, {
    status: DocumentStatus.READY,
    processedAt: new Date(),
  });
  appEvents.emit('document.ready', { documentId, userId, documentName: document.originalName });
  logger.info('Document ready', { documentId, chunks: embedded });
}

export const documentIngestionWorker: WorkerDefinition<typeof QueueName.DocumentIngestion> = {
  queue: QueueName.DocumentIngestion,
  concurrency: 2,

  async process(jobName, payload, job) {
    if (jobName === 'process-document') return processDocument(payload);
    if (jobName === 'embed-document')
      return embedDocument(payload, (percent) => job.updateProgress(percent));
    throw new UnrecoverableError(`Unknown job name: ${jobName}`);
  },

  async onFinalFailure({ documentId, userId }, error) {
    const document = await documentRepository.getDocumentForProcessing(documentId);
    if (!document || document.deletedAt) return;

    await setDocumentState(documentId, userId, {
      status: DocumentStatus.FAILED,
      failureReason: error.message.slice(0, 500),
    });
    appEvents.emit('document.failed', {
      documentId,
      userId,
      documentName: document.originalName,
      reason: error.message,
    });
  },
};
