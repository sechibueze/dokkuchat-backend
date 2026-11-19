import { UpstreamError } from '@/libs/errors';
import type { OpenAiClient } from '../clients/openai.client';
import type { LlmProvider, LlmRequest, LlmResponse } from './llm.provider';

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';

  constructor(
    private readonly client: OpenAiClient,
    readonly model: string,
  ) {}

  async generate({ messages, maxOutputTokens }: LlmRequest): Promise<LlmResponse> {
    const response = await this.client.createChatCompletion({
      model: this.model,
      messages,
      max_completion_tokens: maxOutputTokens,
    });
    const content = response.choices[0]?.message.content?.trim();
    if (!content) throw new UpstreamError('openai returned an empty completion');

    return {
      content,
      model: response.model,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
    };
  }
}
