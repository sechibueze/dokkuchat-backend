import { createHash } from 'node:crypto';
import {
  documentChunkRepository,
  type PendingChunk,
} from '@/apps/documents/document-chunk.repository';
import { usageService } from '../usage/usage.service';
import { getEmbeddingProvider } from './embedding.factory';
import { cachePolicies } from '@/cache/cache.policies';
import { Cache } from '@/cache/cache.service';

export const embeddingService = {
  /** Stored on each chunk.
   * Vectors from different models are never comparable. */
  activeModelId() {
    const provider = getEmbeddingProvider();
    return `${provider.name}:${provider.model}`;
  },

  async embedQuery(
    text: string,
    context: { userId: string; conversationId?: string },
  ): Promise<number[]> {
    const provider = getEmbeddingProvider();
    const policy = cachePolicies.queryEmbedding;
    const key = policy.key(
      provider.name,
      provider.model,
      createHash('sha256').update(text).digest('hex'),
    );

    const cached = await Cache.get<number[]>(key);
    if (cached) return cached; // a cache hit costs nothing, so nothing is billed

    const { vectors, tokensUsed } = await provider.embedTexts([text]);
    await usageService.recordUsage({
      userId: context.userId,
      kind: 'EMBEDDING',
      provider: provider.name,
      model: provider.model,
      promptTokens: tokensUsed,
      conversationId: context.conversationId,
    });

    const vector = vectors[0]!;
    await Cache.set(key, vector, { ttlSeconds: policy.ttlSeconds, tags: policy.tags() });
    return vector;
  },

  async embedAndStoreChunks(params: {
    userId: string;
    documentId: string;
    chunks: PendingChunk[];
  }) {
    const provider = getEmbeddingProvider();
    const { vectors, tokensUsed } = await provider.embedTexts(
      params.chunks.map((chunk) => chunk.content),
    );

    await documentChunkRepository.saveEmbeddings(
      params.chunks.map((chunk, index) => ({ id: chunk.id, embedding: vectors[index]! })),
      embeddingService.activeModelId(),
    );
    await usageService.recordUsage({
      userId: params.userId,
      kind: 'EMBEDDING',
      provider: provider.name,
      model: provider.model,
      promptTokens: tokensUsed,
      documentId: params.documentId,
    });
  },
};
