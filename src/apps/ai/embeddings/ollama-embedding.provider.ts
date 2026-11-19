import type { OllamaClient } from '../clients/ollama.client';
import { BaseEmbeddingProvider } from './embedding.provider';

export class OllamaEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'ollama';
  protected readonly maxBatchSize = 16;

  constructor(
    private readonly client: OllamaClient,
    readonly model: string,
  ) {
    super();
  }

  protected async requestEmbeddings(batch: string[]) {
    const response = await this.client.embed({ model: this.model, input: batch });
    return { vectors: response.embeddings, tokensUsed: response.prompt_eval_count ?? 0 };
  }
}
