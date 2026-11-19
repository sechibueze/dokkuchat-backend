import { env } from '@/config/env';
import { getOllamaClient } from '../clients/ollama.client';
import { getOpenAiClient } from '../clients/openai.client';
import type { LlmProvider } from './llm.provider';
import { OllamaLlmProvider } from './ollama-llm.provider';
import { OpenAiLlmProvider } from './openai-llm.provider';

let provider: LlmProvider | undefined;

export function getLlmProvider(): LlmProvider {
  provider ??=
    env.LLM_PROVIDER === 'ollama'
      ? new OllamaLlmProvider(getOllamaClient(), env.OLLAMA_CHAT_MODEL)
      : new OpenAiLlmProvider(getOpenAiClient(), env.OPENAI_CHAT_MODEL);
  return provider;
}
