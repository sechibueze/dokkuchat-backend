import { UpstreamError } from '@/libs/errors';
import type { LlmProvider, LlmRequest, LlmResponse } from '../llm.provider';
import { OpenAiCompatibleClient } from '@/apps/ai/clients/openai-compatible.client';
import { parseArguments, toOpenAiMessage } from '../openai-llm.provider';
export class OpenAiCompatibleLlmProvider implements LlmProvider {
  constructor(
    readonly name: string,
    private readonly client: OpenAiCompatibleClient,
    readonly model: string,
    readonly supportsTools: boolean,
  ) {}

  async generate({ messages, maxOutputTokens, tools }: LlmRequest): Promise<LlmResponse> {
    const response = await this.client.createChatCompletion({
      model: this.model,
      messages: messages.map(toOpenAiMessage),
      max_tokens: maxOutputTokens,
      ...(this.supportsTools && tools?.length
        ? {
            tools: tools.map((t) => ({
              type: 'function',
              function: { name: t.name, description: t.description, parameters: t.parameters },
            })),
          }
        : {}),
    });

    // OpenRouter can return HTTP 200 with an error body and no choices.
    const message = response.choices?.[0]?.message;
    if (!message) {
      throw new UpstreamError(
        `${this.name} returned no completion${response.error?.message ? `: ${response.error.message}` : ''}`,
      );
    }

    const toolCalls = (message.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: parseArguments(call.function.arguments),
    }));
    const content = message.content?.trim() ?? '';
    if (!content && toolCalls.length === 0)
      throw new UpstreamError(`${this.name} returned an empty completion`);

    return {
      content,
      toolCalls,
      model: response.model ?? this.model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    };
  }
}
