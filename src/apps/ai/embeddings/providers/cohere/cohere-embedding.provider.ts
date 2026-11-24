import type { CohereClient } from './cohere.client';

import {
  BaseEmbeddingProvider,
  EMBEDDING_DIMENSIONS,
  type EmbeddingPurpose,
} from '@/apps/ai/embeddings/embedding.provider';

const INPUT_TYPES = {
  document: 'search_document',
  query: 'search_query',
} as const satisfies Record<EmbeddingPurpose, string>;

export class CohereEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'cohere';
  protected readonly maxBatchSize = 96;

  constructor(
    private readonly client: CohereClient,
    readonly model: string,
  ) {
    super();
  }

  protected async requestEmbeddings(batch: string[], purpose: EmbeddingPurpose) {
    const response = await this.client.embed({
      model: this.model,
      texts: batch,
      input_type: INPUT_TYPES[purpose],
      embedding_types: ['float'],
      // embed-v4.0 supports 1536 natively; v3 models are fixed at 1024 and reject this field.
      ...(this.model.startsWith('embed-v4') ? { output_dimension: EMBEDDING_DIMENSIONS } : {}),
    });
    return {
      vectors: response.embeddings.float,
      tokensUsed: response.meta?.billed_units?.input_tokens ?? 0,
    };
  }
}
