import { OpenAiCompatibleClient } from '@/apps/ai/clients/openai-compatible.client';
import { env } from '@/config/env';
import { ResilientHttpClient } from '@/services/http/resilient-http-client';

let client: OpenAiCompatibleClient | undefined;

export function getOpenRouterClient() {
  if (!client) {
    if (!env.OPENROUTER_API_KEY)
      throw new Error('OPENROUTER_API_KEY is required to use the OpenRouter provider');
    client = new OpenAiCompatibleClient(
      new ResilientHttpClient({
        name: 'openrouter',
        baseURL: env.OPENROUTER_BASE_URL,
        timeoutMs: 30_000,
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          // Optional attribution headers
          ...(env.OPENROUTER_SITE_URL && { 'HTTP-Referer': env.OPENROUTER_SITE_URL }),
          ...(env.OPENROUTER_APP_NAME && { 'X-Title': env.OPENROUTER_APP_NAME }),
        },
        retry: { attempts: 4, maxDelayMs: 15_000 },
      }),
    );
  }
  return client;
}
