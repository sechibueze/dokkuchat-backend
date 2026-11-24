import type { VoyageClient } from './voyage.client';
import {
  BaseEmbeddingProvider,
  type EmbeddingPurpose,
} from '@/apps/ai/embeddings/embedding.provider';

export class VoyageEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'voyage';
  protected readonly maxBatchSize = 128;

  constructor(
    private readonly client: VoyageClient,
    readonly model: string,
  ) {
    super();
  }

  protected async requestEmbeddings(batch: string[], purpose: EmbeddingPurpose) {
    // Default output is 1024 dims; zero-padded to 1536 by the base class.
    const response = await this.client.createEmbeddings({
      model: this.model,
      input: batch,
      input_type: purpose,
    });
    const vectors = [...response.data]
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
    return { vectors, tokensUsed: response.usage?.total_tokens ?? 0 };
  }
}
