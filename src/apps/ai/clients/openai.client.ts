import { env } from '@/config/env';
import { ResilientHttpClient } from '@/services/http/resilient-http-client';

export interface OpenAiEmbeddingResponse {
  model: string;
  data: { index: number; embedding: number[] }[];
  usage: { prompt_tokens: number; total_tokens: number };
}

export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAiChatResponse {
  model: string;
  choices: {
    message: {
      content: string | null;
      tool_calls?: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }[];
    };
    finish_reason: string;
  }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class OpenAiClient {
  constructor(private readonly http: ResilientHttpClient) {}

  createEmbeddings(body: { model: string; input: string[]; dimensions?: number }) {
    return this.http.post<OpenAiEmbeddingResponse>('/embeddings', body);
  }

  createChatCompletion(body: {
    model: string;
    messages: OpenAiChatMessage[];
    max_completion_tokens: number;
  }) {
    return this.http.post<OpenAiChatResponse>('/chat/completions', body, { timeout: 60_000 });
  }
}

let client: OpenAiClient | undefined;

export function getOpenAiClient() {
  if (!client) {
    if (!env.OPENAI_API_KEY)
      throw new Error('OPENAI_API_KEY is required to use the OpenAI provider');
    client = new OpenAiClient(
      new ResilientHttpClient({
        name: 'openai',
        baseURL: env.OPENAI_BASE_URL,
        timeoutMs: 30_000,
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      }),
    );
  }
  return client;
}
