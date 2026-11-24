import { randomUUID } from 'node:crypto';
import { UpstreamError } from '@/libs/errors';
import type {
  GeminiClient,
  GeminiContent,
  GeminiPart,
} from '@/apps/ai/embeddings/providers/gemini/gemini.client';
import type { LlmMessage, LlmProvider, LlmRequest, LlmResponse } from '@/apps/ai/llm/llm.provider';

/** Gemini requires `functionResponse.response` to be an object. */
function toResponseObject(content: string): Record<string, unknown> {
  try {
    const value = JSON.parse(content);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // not JSON, wrap below
  }
  return { result: content };
}

function toGeminiRequest(messages: LlmMessage[]) {
  const system: string[] = [];
  const contents: GeminiContent[] = [];
  const toolNames = new Map<string, string>();

  for (const message of messages) {
    switch (message.role) {
      case 'system':
        system.push(message.content);
        break;
      case 'user':
        contents.push({ role: 'user', parts: [{ text: message.content }] });
        break;
      case 'assistant': {
        const parts: GeminiPart[] = [];
        if (message.content) parts.push({ text: message.content });
        for (const call of message.toolCalls ?? []) {
          toolNames.set(call.id, call.name);
          parts.push({ functionCall: { name: call.name, args: call.arguments } });
        }
        if (parts.length) contents.push({ role: 'model', parts });
        break;
      }
      case 'tool': {
        const part: GeminiPart = {
          functionResponse: {
            name: toolNames.get(message.toolCallId) ?? 'unknown_tool',
            response: toResponseObject(message.content),
          },
        };
        const last = contents.at(-1);
        if (last?.role === 'user' && last.parts.every((p) => p.functionResponse)) {
          last.parts.push(part);
        } else {
          contents.push({ role: 'user', parts: [part] });
        }
        break;
      }
    }
  }

  return {
    contents,
    systemInstruction: system.length ? { parts: [{ text: system.join('\n\n') }] } : undefined,
  };
}

export class GeminiLlmProvider implements LlmProvider {
  readonly name = 'gemini';
  readonly supportsTools = true;

  constructor(
    private readonly client: GeminiClient,
    readonly model: string,
  ) {}

  async generate({ messages, maxOutputTokens, tools }: LlmRequest): Promise<LlmResponse> {
    const { contents, systemInstruction } = toGeminiRequest(messages);
    const response = await this.client.generateContent(this.model, {
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: { maxOutputTokens },
      ...(tools?.length
        ? {
            tools: [
              {
                functionDeclarations: tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parametersJsonSchema: t.parameters,
                })),
              },
            ],
          }
        : {}),
    });

    const candidate = response.candidates?.[0];
    if (!candidate) {
      const reason = response.promptFeedback?.blockReason;
      throw new UpstreamError(
        `gemini returned no candidates${reason ? ` (blocked: ${reason})` : ''}`,
      );
    }

    const parts = candidate.content?.parts ?? [];
    const content = parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('')
      .trim();
    const toolCalls = parts.flatMap((p) =>
      p.functionCall
        ? [
            {
              id: p.functionCall.id ?? `gemini-call-${randomUUID()}`,
              name: p.functionCall.name,
              arguments: p.functionCall.args ?? {},
            },
          ]
        : [],
    );
    if (!content && toolCalls.length === 0) {
      throw new UpstreamError(
        `gemini returned an empty completion (finishReason: ${candidate.finishReason ?? 'unknown'})`,
      );
    }

    const usage = response.usageMetadata;
    return {
      content,
      toolCalls,
      model: response.modelVersion ?? this.model,
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
    };
  }
}
