import type { GeminiClient, GeminiTaskType } from './gemini.client';
import {
  BaseEmbeddingProvider,
  EMBEDDING_DIMENSIONS,
  type EmbeddingPurpose,
} from '@/apps/ai/embeddings/embedding.provider';

const TASK_TYPES: Record<EmbeddingPurpose, GeminiTaskType> = {
  document: 'RETRIEVAL_DOCUMENT',
  query: 'RETRIEVAL_QUERY',
};

/** Gemini embeddings below the full 3072 dims are not unit-length. */
function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vector : vector.map((v) => v / norm);
}

export class GeminiEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'gemini';
  protected readonly maxBatchSize = 100;

  constructor(
    private readonly client: GeminiClient,
    readonly model: string,
  ) {
    super();
  }

  protected async requestEmbeddings(batch: string[], purpose: EmbeddingPurpose) {
    const response = await this.client.batchEmbedContents(this.model, {
      requests: batch.map((text) => ({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        taskType: TASK_TYPES[purpose],
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    });
    return {
      vectors: response.embeddings.map((e) => l2Normalize(e.values)),
      // The API returns no usage, so this is a rough estimate (~4 chars per token).
      tokensUsed: Math.ceil(batch.reduce((sum, text) => sum + text.length, 0) / 4),
    };
  }
}
