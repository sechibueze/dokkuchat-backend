import { env } from '@/config/env';
import { ResilientHttpClient } from '@/services/http/resilient-http-client';

export interface JinaEmbeddingResponse {
  data: { index: number; embedding: number[] }[];
  usage: { total_tokens: number };
}

export class JinaClient {
  constructor(private readonly http: ResilientHttpClient) {}

  createEmbeddings(body: {
    model: string;
    input: string[];
    task: 'retrieval.passage' | 'retrieval.query';
    dimensions?: number;
    embedding_type?: 'float';
  }) {
    return this.http.post<JinaEmbeddingResponse>('/embeddings', body);
  }
}

let client: JinaClient | undefined;

export function getJinaClient() {
  if (!client) {
    if (!env.JINA_API_KEY) throw new Error('JINA_API_KEY is required to use the Jina provider');
    client = new JinaClient(
      new ResilientHttpClient({
        name: 'jina',
        baseURL: env.JINA_BASE_URL,
        timeoutMs: 30_000,
        headers: { Authorization: `Bearer ${env.JINA_API_KEY}` },
        retry: { attempts: 4, maxDelayMs: 15_000 },
      }),
    );
  }
  return client;
}
