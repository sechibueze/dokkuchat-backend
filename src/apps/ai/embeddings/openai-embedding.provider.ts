import type { OpenAiClient } from '../clients/openai.client';
import { BaseEmbeddingProvider, EMBEDDING_DIMENSIONS } from './embedding.provider';

export class OpenAiEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'openai';
  protected readonly maxBatchSize = 64;

  constructor(
    private readonly client: OpenAiClient,
    readonly model: string,
  ) {
    super();
  }

  protected async requestEmbeddings(batch: string[]) {
    const response = await this.client.createEmbeddings({
      model: this.model,
      input: batch,
      ...(this.model.startsWith('text-embedding-3') && { dimensions: EMBEDDING_DIMENSIONS }),
    });
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    return {
      vectors: ordered.map((item) => item.embedding),
      tokensUsed: response.usage.total_tokens,
    };
  }
}
