import type { JinaClient } from './jina.client';
import {
  BaseEmbeddingProvider,
  type EmbeddingPurpose,
} from '@/apps/ai/embeddings/embedding.provider';

const TASKS = {
  document: 'retrieval.passage',
  query: 'retrieval.query',
} as const satisfies Record<EmbeddingPurpose, string>;

export class JinaEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'jina';
  protected readonly maxBatchSize = 64;

  constructor(
    private readonly client: JinaClient,
    readonly model: string,
  ) {
    super();
  }

  protected async requestEmbeddings(batch: string[], purpose: EmbeddingPurpose) {
    const response = await this.client.createEmbeddings({
      model: this.model,
      input: batch,
      task: TASKS[purpose],
      dimensions: 1024, // v3 max; zero-padded to 1536 by the base class
      embedding_type: 'float',
    });
    const vectors = [...response.data]
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
    return { vectors, tokensUsed: response.usage?.total_tokens ?? 0 };
  }
}
