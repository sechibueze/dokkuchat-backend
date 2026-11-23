export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: LlmToolCall[] }
  | { role: 'tool'; content: string; toolCallId: string };

export interface LlmRequest {
  messages: LlmMessage[];
  maxOutputTokens: number;
  tools?: LlmToolDefinition[];
}
export interface LlmResponse {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  toolCalls: LlmToolCall[];
}
export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  readonly supportsTools: boolean;
  generate(request: LlmRequest): Promise<LlmResponse>;
}
