import { env } from '@/config/env';
import { getOllamaClient } from '../clients/ollama.client';
import { getOpenAiClient } from '../clients/openai.client';
import type { LlmProvider } from './llm.provider';
import { OllamaLlmProvider } from './ollama-llm.provider';
import { OpenAiLlmProvider } from './openai-llm.provider';
import { GeminiLlmProvider } from './providers/gemini/gemini-llm.provider';
import { getGeminiClient } from '../embeddings/providers/gemini/gemini.client';
import { getCloudflareClient } from './providers/cloudflare/cloudflare.client';
import { OpenAiCompatibleLlmProvider } from './providers/openai-compatible-llm.provider';
import { getOpenRouterClient } from './providers/open-router/open-router.client';
import { getGroqClient } from './providers/groq/groq.client';

let provider: LlmProvider | undefined;

function createLlmProvider(): LlmProvider {
  const type = env.LLM_PROVIDER;
  switch (type) {
    case 'ollama':
      return new OllamaLlmProvider(getOllamaClient(), env.OLLAMA_CHAT_MODEL);
    case 'openai':
      return new OpenAiLlmProvider(getOpenAiClient(), env.OPENAI_CHAT_MODEL);
    case 'groq':
      return new OpenAiCompatibleLlmProvider('groq', getGroqClient(), env.GROQ_CHAT_MODEL, true);
    case 'openrouter':
      return new OpenAiCompatibleLlmProvider(
        'openrouter',
        getOpenRouterClient(),
        env.OPENROUTER_CHAT_MODEL,
        true,
      );
    case 'cloudflare':
      return new OpenAiCompatibleLlmProvider(
        'cloudflare',
        getCloudflareClient(),
        env.CLOUDFLARE_CHAT_MODEL,
        false,
      );
    case 'gemini':
      return new GeminiLlmProvider(getGeminiClient(), env.GEMINI_CHAT_MODEL);
    default: {
      throw new Error(`Unsupported LLM provider: ${String(type)}`);
    }
  }
}

export function getLlmProvider(): LlmProvider {
  provider ??= createLlmProvider();
  return provider;
}
