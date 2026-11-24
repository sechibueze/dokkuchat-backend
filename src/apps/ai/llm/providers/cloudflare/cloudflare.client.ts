import { OpenAiCompatibleClient } from '@/apps/ai/clients/openai-compatible.client';
import { env } from '@/config/env';
import { ResilientHttpClient } from '@/services/http/resilient-http-client';

let client: OpenAiCompatibleClient | undefined;

export function getCloudflareClient() {
  if (!client) {
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN)
      throw new Error(
        'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required to use the Cloudflare provider',
      );
    client = new OpenAiCompatibleClient(
      new ResilientHttpClient({
        name: 'cloudflare',
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
        timeoutMs: 30_000,
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
        retry: { attempts: 4, maxDelayMs: 15_000 },
      }),
    );
  }
  return client;
}
