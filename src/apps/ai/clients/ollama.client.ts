import { env } from '@/config/env';
import { ResilientHttpClient } from '@/services/http/resilient-http-client';

export class OllamaClient {
  constructor(private readonly http: ResilientHttpClient) {}

  embed(body: { model: string; input: string[] }) {
    return this.http.post<{ model: string; embeddings: number[][]; prompt_eval_count?: number }>(
      '/api/embed',
      body,
      {
        timeout: 120_000,
      },
    );
  }

  chat(body: {
    model: string;
    messages: { role: string; content: string }[];
    stream: false;
    options?: { num_predict?: number };
  }) {
    return this.http.post<{
      model: string;
      message: { content: string };
      prompt_eval_count?: number;
      eval_count?: number;
    }>('/api/chat', body, { timeout: 180_000 });
  }
}

let client: OllamaClient | undefined;

export function getOllamaClient() {
  client ??= new OllamaClient(
    new ResilientHttpClient({
      name: 'ollama',
      baseURL: env.OLLAMA_BASE_URL,
      timeoutMs: 120_000,
      retry: { attempts: 2 },
    }),
  );
  return client;
}
