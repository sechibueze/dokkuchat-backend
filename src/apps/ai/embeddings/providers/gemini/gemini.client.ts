import { env } from '@/config/env';
import { ResilientHttpClient } from '@/services/http/resilient-http-client';

export type GeminiTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

export interface GeminiBatchEmbedResponse {
  embeddings: { values: number[] }[];
}

export interface GeminiPart {
  text?: string;
  thought?: boolean;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiGenerateRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: { maxOutputTokens?: number };
  tools?: {
    functionDeclarations: {
      name: string;
      description: string;
      parametersJsonSchema: Record<string, unknown>;
    }[];
  }[];
}

export interface GeminiGenerateResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  modelVersion?: string;
}

export class GeminiClient {
  constructor(private readonly http: ResilientHttpClient) {}

  batchEmbedContents(
    model: string,
    body: {
      requests: {
        model: string;
        content: { parts: { text: string }[] };
        taskType: GeminiTaskType;
        outputDimensionality?: number;
      }[];
    },
  ) {
    return this.http.post<GeminiBatchEmbedResponse>(`/models/${model}:batchEmbedContents`, body);
  }

  generateContent(model: string, body: GeminiGenerateRequest) {
    return this.http.post<GeminiGenerateResponse>(`/models/${model}:generateContent`, body, {
      timeout: 60_000,
    });
  }
}

let client: GeminiClient | undefined;

export function getGeminiClient() {
  if (!client) {
    if (!env.GEMINI_API_KEY)
      throw new Error('GEMINI_API_KEY is required to use the Gemini provider');
    client = new GeminiClient(
      new ResilientHttpClient({
        name: 'gemini',
        baseURL: env.GEMINI_BASE_URL,
        timeoutMs: 30_000,
        headers: { 'x-goog-api-key': env.GEMINI_API_KEY },
        retry: { attempts: 4, maxDelayMs: 15_000 },
      }),
    );
  }
  return client;
}
