import type { ResilientHttpClient } from '@/services/http/resilient-http-client';

export interface ChatCompletionBody {
  model: string;
  messages: unknown[];
  max_tokens: number;
  tools?: unknown[];
}

export interface ChatCompletionResponse {
  model?: string;
  choices?: {
    message: {
      content: string | null;
      tool_calls?: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }[];
    };
    finish_reason?: string;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: number | string };
}

export class OpenAiCompatibleClient {
  constructor(private readonly http: ResilientHttpClient) {}

  createChatCompletion(body: ChatCompletionBody) {
    return this.http.post<ChatCompletionResponse>('/chat/completions', body, { timeout: 60_000 });
  }
}
