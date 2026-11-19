import { getOllamaClient } from '@/apps/ai/clients/ollama.client';
import { getOpenAiClient } from '@/apps/ai/clients/openai.client';
import type { EmbeddingProvider } from './embedding.provider';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider';
import { OpenAiEmbeddingProvider } from './openai-embedding.provider';
import { env } from '@/config/env';

let provider: EmbeddingProvider | undefined;

export function getEmbeddingProvider(): EmbeddingProvider {
  provider ??=
    env.EMBEDDING_PROVIDER === 'ollama'
      ? new OllamaEmbeddingProvider(getOllamaClient(), env.OLLAMA_EMBEDDING_MODEL)
      : new OpenAiEmbeddingProvider(getOpenAiClient(), env.OPENAI_EMBEDDING_MODEL);
  return provider;
}
