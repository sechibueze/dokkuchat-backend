import { getOllamaClient } from '@/apps/ai/clients/ollama.client';
import { getOpenAiClient } from '@/apps/ai/clients/openai.client';
import type { EmbeddingProvider } from './embedding.provider';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider';
import { OpenAiEmbeddingProvider } from './openai-embedding.provider';
import { env } from '@/config/env';
import { VoyageEmbeddingProvider } from './providers/voyage/voyage-embedding.provider';
import { getVoyageClient } from './providers/voyage/voyage.client';
import { CohereEmbeddingProvider } from './providers/cohere/cohere-embedding.provider';
import { getCohereClient } from './providers/cohere/cohere.client';
import { GeminiEmbeddingProvider } from './providers/gemini/gemini-embedding.provider';
import { getGeminiClient } from './providers/gemini/gemini.client';
import { JinaEmbeddingProvider } from './providers/jina/jina-embedding.provider';
import { getJinaClient } from './providers/jina/jina.client';

let provider: EmbeddingProvider | undefined;

function createEmbeddingProvider(): EmbeddingProvider {
  const type = env.EMBEDDING_PROVIDER;
  switch (type) {
    case 'ollama':
      return new OllamaEmbeddingProvider(getOllamaClient(), env.OLLAMA_EMBEDDING_MODEL);
    case 'openai':
      return new OpenAiEmbeddingProvider(getOpenAiClient(), env.OPENAI_EMBEDDING_MODEL);
    case 'voyage':
      return new VoyageEmbeddingProvider(getVoyageClient(), env.VOYAGE_EMBEDDING_MODEL);
    case 'cohere':
      return new CohereEmbeddingProvider(getCohereClient(), env.COHERE_EMBEDDING_MODEL);
    case 'gemini':
      return new GeminiEmbeddingProvider(getGeminiClient(), env.GEMINI_EMBEDDING_MODEL);
    case 'jina':
      return new JinaEmbeddingProvider(getJinaClient(), env.JINA_EMBEDDING_MODEL);
    default: {
      throw new Error(`Unsupported embedding provider: ${String(type)}`);
    }
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  provider ??= createEmbeddingProvider();
  return provider;
}
