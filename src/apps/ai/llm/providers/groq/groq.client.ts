import { OpenAiCompatibleClient } from '@/apps/ai/clients/openai-compatible.client';
import { env } from '@/config/env';
import { ResilientHttpClient } from '@/services/http/resilient-http-client';

let client: OpenAiCompatibleClient | undefined;

export function getGroqClient() {
  if (!client) {
    if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is required to use the Groq provider');
    client = new OpenAiCompatibleClient(
      new ResilientHttpClient({
        name: 'groq',
        baseURL: env.GROQ_BASE_URL,
        timeoutMs: 30_000,
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
        retry: { attempts: 4, maxDelayMs: 15_000 },
      }),
    );
  }
  return client;
}
