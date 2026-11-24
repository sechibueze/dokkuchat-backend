import { env } from '@/config/env';
import { ResilientHttpClient } from '@/services/http/resilient-http-client';

export interface VoyageEmbeddingResponse {
  data: { index: number; embedding: number[] }[];
  usage: { total_tokens: number };
}

export class VoyageClient {
  constructor(private readonly http: ResilientHttpClient) {}

  createEmbeddings(body: {
    model: string;
    input: string[];
    input_type?: 'query' | 'document';
    output_dimension?: number;
  }) {
    return this.http.post<VoyageEmbeddingResponse>('/embeddings', body);
  }
}

let client: VoyageClient | undefined;

export function getVoyageClient() {
  if (!client) {
    if (!env.VOYAGE_API_KEY)
      throw new Error('VOYAGE_API_KEY is required to use the Voyage provider');
    client = new VoyageClient(
      new ResilientHttpClient({
        name: 'voyage',
        baseURL: env.VOYAGE_BASE_URL,
        timeoutMs: 30_000,
        headers: { Authorization: `Bearer ${env.VOYAGE_API_KEY}` },
        retry: { attempts: 4, maxDelayMs: 15_000 },
      }),
    );
  }
  return client;
}
