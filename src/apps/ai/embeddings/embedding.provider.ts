import { UpstreamError } from '@/libs/errors';

/** Fixed by the `vector(1536)` column. */
export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingBatchResult {
  vectors: number[][];
  tokensUsed: number;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  /** Returns one vector per input, in the same order. */
  embedTexts(texts: string[]): Promise<EmbeddingBatchResult>;
}

export function normalizeDimensions(
  vector: number[],
  source: string,
  target = EMBEDDING_DIMENSIONS,
): number[] {
  if (vector.length === target) return vector;
  if (vector.length > target) {
    throw new Error(
      `${source} produced ${vector.length}-dimension vectors but the column holds ${target}`,
    );
  }
  return [...vector, ...new Array<number>(target - vector.length).fill(0)];
}

export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
  abstract readonly name: string;
  abstract readonly model: string;
  protected abstract readonly maxBatchSize: number;
  protected abstract requestEmbeddings(batch: string[]): Promise<EmbeddingBatchResult>;

  async embedTexts(texts: string[]): Promise<EmbeddingBatchResult> {
    const vectors: number[][] = [];
    let tokensUsed = 0;

    for (let start = 0; start < texts.length; start += this.maxBatchSize) {
      const batch = texts.slice(start, start + this.maxBatchSize);
      const result = await this.requestEmbeddings(batch);
      if (result.vectors.length !== batch.length) {
        throw new UpstreamError(
          `${this.name} returned ${result.vectors.length} embeddings for ${batch.length} inputs`,
        );
      }
      vectors.push(...result.vectors.map((vector) => normalizeDimensions(vector, this.name)));
      tokensUsed += result.tokensUsed;
    }
    return { vectors, tokensUsed };
  }
}
