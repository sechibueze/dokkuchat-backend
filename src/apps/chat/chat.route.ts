import { Router } from 'express';
import { authenticate } from '@/apps/auth/auth.middleware';
import { chatController } from './chat.controller';
import {
  conversationIdParamSchema,
  createConversationSchema,
  listQuerySchema,
  sendMessageSchema,
} from './chat.schema';
import { validateRequest } from '@/middlewares/validate.middleware';
import { rateLimit, rateLimitPolicies } from '@/middlewares/rate-limit.middleware';

export const chatRouter = Router();

chatRouter.use(authenticate);
chatRouter.post('/', validateRequest(createConversationSchema), chatController.createConversation);
chatRouter.get('/', validateRequest(listQuerySchema, 'query'), chatController.listConversations);
chatRouter.get(
  '/:id/messages',
  validateRequest(conversationIdParamSchema, 'params'),
  validateRequest(listQuerySchema, 'query'),
  chatController.listMessages,
);
chatRouter.post(
  '/:id/messages',
  rateLimit(rateLimitPolicies.chatMessage),
  validateRequest(conversationIdParamSchema, 'params'),
  validateRequest(sendMessageSchema),
  chatController.sendMessage,
);
chatRouter.delete(
  '/:id',
  validateRequest(conversationIdParamSchema, 'params'),
  chatController.deleteConversation,
);
