import { UpstreamError } from '@/libs/errors';
import type { OllamaClient } from '../clients/ollama.client';
import type { LlmProvider, LlmRequest, LlmResponse } from './llm.provider';

export class OllamaLlmProvider implements LlmProvider {
  readonly name = 'ollama';

  constructor(
    private readonly client: OllamaClient,
    readonly model: string,
  ) {}

  async generate({ messages, maxOutputTokens }: LlmRequest): Promise<LlmResponse> {
    const response = await this.client.chat({
      model: this.model,
      messages,
      stream: false,
      options: { num_predict: maxOutputTokens },
    });
    const content = response.message.content.trim();
    if (!content) throw new UpstreamError('ollama returned an empty completion');

    return {
      content,
      model: response.model,
      promptTokens: response.prompt_eval_count ?? 0,
      completionTokens: response.eval_count ?? 0,
    };
  }
}
