import { z } from 'zod';
import { MAX_QUESTION_CHARS } from './chat.config';

export const conversationIdParamSchema = z.object({ id: z.uuid() });

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  documentIds: z.array(z.uuid()).max(20).default([]),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
