import { db } from '@/database';
import type { Prisma, ToolApproval } from '@/database/generated/prisma/client';

import type { AuthenticatedUser } from '../../types/express';
import { usageService } from '../ai/usage/usage.service';
import { getLlmProvider } from '../ai/llm/llm.factory';
import type { LlmMessage, LlmResponse, LlmToolCall } from '../ai/llm/llm.provider';
import { toApprovalView } from '../approvals/approval.mapper';
import { toolApprovalRepository } from '../approvals/tool-approval.repository';
import { mcpClientRegistry, type McpToolEntry } from '../mcp/client/mcp-client.registry';
import { APPROVAL_TTL_MS, MAX_TOOL_CALLS_PER_TURN } from '../mcp/mcp.config';
import { DEFAULT_CONVERSATION_TITLE, MAX_OUTPUT_TOKENS, NO_ANSWER_MESSAGE } from './chat.config';
import { toMessageView, type Citation } from './chat.mapper';
import { conversationRepository } from './conversation.repository';
import { messageRepository } from './message.repository';
import { logger } from '@/libs/logger';

interface AgentState {
  promptMessages: LlmMessage[];
  assistantContent: string;
  toolCalls: LlmToolCall[];
}

const REJECTED_RESULT = 'The user declined to run this tool. Do not retry it; answer without it.';
const FAILURE_MESSAGE = 'I could not complete that request. Please try again.';

async function runApprovedTool(approval: ToolApproval): Promise<string> {
  try {
    const result = await mcpClientRegistry.callTool(
      approval.serverName,
      approval.toolName,
      approval.arguments as Record<string, unknown>,
    );
    await toolApprovalRepository.saveOutcome(approval.id, { result });
    return result;
  } catch (error) {
    const message = (error as Error).message;
    await toolApprovalRepository.saveOutcome(approval.id, { error: message.slice(0, 500) });
    return `The tool failed: ${message.slice(0, 300)}`;
  }
}

export const agentTurnService = {
  /** Stores the proposal. Runs immediately only when every call is allow-listed. */
  async beginToolTurn(params: {
    user: AuthenticatedUser;
    conversation: { id: string; title: string };
    question: string;
    promptMessages: LlmMessage[];
    completion: LlmResponse;
    catalog: McpToolEntry[];
    citations: Citation[];
  }) {
    const byName = new Map(params.catalog.map((entry) => [entry.functionName, entry]));
    // Names the model invented are dropped, never executed.
    const calls = params.completion.toolCalls
      .filter((c) => byName.has(c.name))
      .slice(0, MAX_TOOL_CALLS_PER_TURN);
    if (calls.length === 0) return null;

    const now = Date.now();
    const state: AgentState = {
      promptMessages: params.promptMessages,
      assistantContent: params.completion.content,
      toolCalls: calls,
    };
    const waitingText = `Waiting to run: ${calls.map((c) => byName.get(c.name)!.toolName).join(', ')}`;

    const { userMessage, placeholder, approvals } = await db.$transaction(async (tx) => {
      const asked = await messageRepository.createMessage(
        {
          conversationId: params.conversation.id,
          role: 'USER',
          content: params.question,
          createdAt: new Date(now),
        },
        tx,
      );
      const waiting = await messageRepository.createMessage(
        {
          conversationId: params.conversation.id,
          role: 'ASSISTANT',
          content: waitingText,
          createdAt: new Date(now + 1),
          citations: params.citations as unknown as Prisma.InputJsonValue,
          model: params.completion.model,
          status: 'AWAITING_APPROVAL',
          agentState: state as unknown as Prisma.InputJsonValue,
        },
        tx,
      );
      const rows = await toolApprovalRepository.createManyAndReturn(
        calls.map((call) => {
          const entry = byName.get(call.name)!;
          return {
            userId: params.user.id,
            conversationId: params.conversation.id,
            messageId: waiting.id,
            toolCallId: call.id,
            serverName: entry.serverName,
            toolName: entry.toolName,
            arguments: call.arguments as Prisma.InputJsonValue,
            status: entry.autoApprove ? ('APPROVED' as const) : ('PENDING' as const),
            autoApproved: entry.autoApprove,
            decidedAt: entry.autoApprove ? new Date() : null,
            expiresAt: new Date(now + APPROVAL_TTL_MS),
          };
        }),
        tx,
      );
      await conversationRepository.touchConversation(
        params.conversation.id,
        params.conversation.title === DEFAULT_CONVERSATION_TITLE
          ? { title: params.question.slice(0, 60) }
          : {},
        tx,
      );
      return { userMessage: asked, placeholder: waiting, approvals: rows };
    });

    const pending = approvals.filter((a) => a.status === 'PENDING');
    pending.forEach(() => appEvents.emit('tool.approval.changed', { status: 'PENDING' }));
    await cache.invalidateTags(...cachePolicies.conversationList.tags(params.user.id));
    logger.info('Tool call proposed', {
      messageId: placeholder.id,
      calls: calls.length,
      pending: pending.length,
    });

    const assistantMessage =
      pending.length === 0
        ? ((await agentTurnService.resume(placeholder.id)) ?? placeholder)
        : placeholder;
    return {
      userMessage: toMessageView(userMessage),
      assistantMessage: toMessageView(assistantMessage),
      pendingApprovals: pending.map(toApprovalView),
    };
  },

  /** Runs approved tools, asks the model for the final answer, replaces the placeholder. At most once per message. */
  async resume(messageId: string) {
    const message = await messageRepository.claimAwaitingMessage(messageId);
    if (!message) return null;

    const state = message.agentState as unknown as AgentState;
    const approvals = await toolApprovalRepository.listByMessage(messageId);
    const userId = approvals[0]!.userId;

    try {
      const toolMessages: LlmMessage[] = [];
      for (const approval of approvals) {
        const content =
          approval.status === 'APPROVED' ? await runApprovedTool(approval) : REJECTED_RESULT;
        toolMessages.push({ role: 'tool', toolCallId: approval.toolCallId, content });
      }

      const llm = getLlmProvider();
      const completion = await llm.generate({
        messages: [
          ...state.promptMessages,
          { role: 'assistant', content: state.assistantContent, toolCalls: state.toolCalls },
          ...toolMessages,
        ],
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      await usageService.recordUsage({
        userId,
        kind: 'CHAT_COMPLETION',
        provider: llm.name,
        model: completion.model,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        conversationId: message.conversationId,
      });
      return await messageRepository.completeMessage(messageId, {
        content: completion.content || NO_ANSWER_MESSAGE,
        model: completion.model,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
      });
    } catch (error) {
      logger.error('Could not resume agent turn', { messageId, error: (error as Error).message });
      return await messageRepository.completeMessage(messageId, { content: FAILURE_MESSAGE });
    } finally {
      await cache.invalidateTags(...cachePolicies.conversationList.tags(userId));
    }
  },
};
