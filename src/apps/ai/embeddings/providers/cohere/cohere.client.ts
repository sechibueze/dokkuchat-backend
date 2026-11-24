import { env } from '@/config/env';
import { ResilientHttpClient } from '@/services/http/resilient-http-client';

export interface CohereEmbedResponse {
  embeddings: { float: number[][] };
  meta?: { billed_units?: { input_tokens?: number } };
}

export class CohereClient {
  constructor(private readonly http: ResilientHttpClient) {}

  embed(body: {
    model: string;
    texts: string[];
    input_type: 'search_document' | 'search_query';
    embedding_types: ['float'];
    output_dimension?: number;
  }) {
    return this.http.post<CohereEmbedResponse>('/embed', body);
  }
}

let client: CohereClient | undefined;

export function getCohereClient() {
  if (!client) {
    if (!env.COHERE_API_KEY)
      throw new Error('COHERE_API_KEY is required to use the Cohere provider');
    client = new CohereClient(
      new ResilientHttpClient({
        name: 'cohere',
        baseURL: env.COHERE_BASE_URL,
        timeoutMs: 30_000,
        headers: { Authorization: `Bearer ${env.COHERE_API_KEY}` },
        retry: { attempts: 4, maxDelayMs: 15_000 },
      }),
    );
  }
  return client;
}
