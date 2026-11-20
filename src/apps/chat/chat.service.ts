import { db } from '@/database';
import type { Message, MessageRole } from '@/database/generated/prisma/client';
import { embeddingService } from '../ai/embeddings/embedding.service';
import { getLlmProvider } from '../ai/llm/llm.factory';
import { usageService } from '../ai/usage/usage.service';
import {
  documentChunkRepository,
  type SimilarChunk,
} from '@/apps/documents/document-chunk.repository';
import { documentRepository } from '@/apps/documents/document.repository';
import {
  DEFAULT_CONVERSATION_TITLE,
  HISTORY_MESSAGES,
  MAX_OUTPUT_TOKENS,
  MIN_SIMILARITY,
  NO_ANSWER_MESSAGE,
  RETRIEVAL_TOP_K,
} from './chat.config';
import type { CreateConversationInput, ListQuery } from './chat.schema';
import { conversationRepository } from './conversation.repository';
import { messageRepository } from './message.repository';
import { buildPrompt } from './prompt.builder';
import { Cache, hashKeyPart } from '@/cache/cache.service';
import { cachePolicies } from '@/cache/cache.policies';
import { BadRequestError, NotFoundError } from '@/libs/errors';
import { AuthenticatedUser } from '@/types/express';
import { logger } from '@/libs/logger';

export interface Citation {
  sourceNumber: number;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number;
  snippet: string;
}

const toCitations = (chunks: SimilarChunk[]): Citation[] =>
  chunks.map((chunk, index) => ({
    sourceNumber: index + 1,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    similarity: Math.round(chunk.similarity * 1000) / 1000,
    snippet: chunk.content.slice(0, 240),
  }));

const toMessageView = (message: Message) => ({
  id: message.id,
  role: message.role,
  content: message.content,
  citations: message.citations ?? [],
  model: message.model,
  createdAt: message.createdAt,
});

const toLlmRole = (role: MessageRole) =>
  (role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant';
const invalidateConversationCache = (userId: string) =>
  Cache.invalidateTags(...cachePolicies.conversationList.tags(userId));

export const chatService = {
  async createConversation(userId: string, input: CreateConversationInput) {
    const documentIds = [...new Set(input.documentIds)];
    if (
      documentIds.length > 0 &&
      (await documentRepository.countOwnedDocuments(userId, documentIds)) !== documentIds.length
    ) {
      throw new BadRequestError('One or more documents do not exist');
    }

    const conversation = await conversationRepository.createConversation({
      userId,
      title: input.title ?? DEFAULT_CONVERSATION_TITLE,
      documentIds,
    });
    await invalidateConversationCache(userId);
    return conversation;
  },

  async listConversations(userId: string, query: ListQuery) {
    const policy = cachePolicies.conversationList;
    return Cache.getOrSet(
      policy.key(userId, hashKeyPart(query)),
      { ttlSeconds: policy.ttlSeconds, tags: policy.tags(userId) },
      async () => {
        const { items, total } = await conversationRepository.listConversations({
          userId,
          ...query,
        });
        return {
          conversations: items.map(({ id, title, documentIds, createdAt, updatedAt }) => ({
            id,
            title,
            documentIds,
            createdAt,
            updatedAt,
          })),
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
        };
      },
    );
  },

  async listMessages(userId: string, conversationId: string, query: ListQuery) {
    if (!(await conversationRepository.getConversationById(conversationId, userId))) {
      throw new NotFoundError('Conversation not found');
    }
    const { items, total } = await messageRepository.listMessages({ conversationId, ...query });
    return {
      messages: items.map(toMessageView),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async deleteConversation(userId: string, conversationId: string) {
    if (!(await conversationRepository.softDeleteConversation(conversationId, userId))) {
      throw new NotFoundError('Conversation not found');
    }
    await invalidateConversationCache(userId);
  },

  async askQuestion(user: AuthenticatedUser, conversationId: string, question: string) {
    const conversation = await conversationRepository.getConversationById(conversationId, user.id);
    if (!conversation) throw new NotFoundError('Conversation not found');

    await usageService.assertWithinBudget(user);

    const embedding = await embeddingService.embedQuery(question, {
      userId: user.id,
      conversationId,
    });

    logger.info('chat embeddings ', {
      size: embedding.length,
    });
    const candidates = await documentChunkRepository.searchSimilarChunks({
      userId: user.id,
      embedding,
      embeddingModel: embeddingService.activeModelId(),
      limit: RETRIEVAL_TOP_K,
      documentIds: conversation.documentIds,
    });
    const relevant = candidates.filter((chunk) => chunk.similarity >= MIN_SIMILARITY);

    logger.info('Found relevant chunks', {
      chunkSize: relevant.length,
    });
    let answer = NO_ANSWER_MESSAGE;
    let model: string | undefined;
    let usage = { promptTokens: 0, completionTokens: 0 };

    if (relevant.length > 0) {
      const history = await messageRepository.getRecentMessages(conversationId, HISTORY_MESSAGES);
      const llm = getLlmProvider();
      const completion = await llm.generate({
        messages: buildPrompt({
          question,
          history: history.map((message) => ({
            role: toLlmRole(message.role),
            content: message.content,
          })),
          chunks: relevant,
        }),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });

      answer = completion.content;
      model = completion.model;
      usage = {
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
      };

      await usageService.recordUsage({
        userId: user.id,
        kind: 'CHAT_COMPLETION',
        provider: llm.name,
        model: completion.model,
        ...usage,
        conversationId,
      });
    }

    const citations = toCitations(relevant);
    const now = Date.now();

    // Explicit timestamps: inside one transaction `now()` is identical for both rows,
    // which would make their order ambiguous.
    const [userMessage, assistantMessage] = await db.$transaction(async (tx) => {
      const asked = await messageRepository.createMessage(
        { conversationId, role: 'USER', content: question, createdAt: new Date(now) },
        tx,
      );
      const answered = await messageRepository.createMessage(
        {
          conversationId,
          role: 'ASSISTANT',
          content: answer,
          createdAt: new Date(now + 1),
          citations: JSON.stringify(citations),
          model,
          ...usage,
        },
        tx,
      );
      await conversationRepository.touchConversation(
        conversationId,
        conversation.title === DEFAULT_CONVERSATION_TITLE ? { title: question.slice(0, 60) } : {},
        tx,
      );
      return [asked, answered];
    });

    await invalidateConversationCache(user.id);
    logger.info('Chat turn completed', {
      conversationId,
      sources: relevant.length,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    });

    return {
      userMessage: toMessageView(userMessage),
      assistantMessage: toMessageView(assistantMessage),
    };
  },
};
