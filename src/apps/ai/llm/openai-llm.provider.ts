import { UpstreamError } from '@/libs/errors';
import type { OpenAiChatMessage, OpenAiClient } from '../clients/openai.client';
import type { LlmMessage, LlmProvider, LlmRequest, LlmResponse } from './llm.provider';

export function toOpenAiMessage(message: LlmMessage) {
  if (message.role === 'tool')
    return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      })),
    };
  }
  return { role: message.role, content: message.content };
}

export function parseArguments(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';
  readonly supportsTools = true;

  constructor(
    private readonly client: OpenAiClient,
    readonly model: string,
  ) {}

  async generate({ messages, maxOutputTokens, tools }: LlmRequest): Promise<LlmResponse> {
    const response = await this.client.createChatCompletion({
      model: this.model,
      messages: messages.map(toOpenAiMessage),
      max_completion_tokens: maxOutputTokens,
      ...(tools?.length && {
        tools: tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      }),
    });

    const message = response.choices[0]?.message;
    const toolCalls = (message?.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: parseArguments(call.function.arguments),
    }));
    const content = message?.content?.trim() ?? '';
    if (!content && toolCalls.length === 0)
      throw new UpstreamError('openai returned an empty completion');

    return {
      content,
      toolCalls,
      model: response.model,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
    };
  }
}
