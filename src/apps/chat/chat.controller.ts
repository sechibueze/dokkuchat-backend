import type { Request, Response } from 'express';
import type { CreateConversationInput, ListQuery } from './chat.schema';
import { chatService } from './chat.service';
import { sendSuccess } from '@/utils/response';

export const chatController = {
  async createConversation(req: Request, res: Response) {
    const { id, title, documentIds, createdAt } = await chatService.createConversation(
      req.user!.id,
      req.body as CreateConversationInput,
    );
    sendSuccess(res, { id, title, documentIds, createdAt }, { status: 201 });
  },

  async listConversations(req: Request, res: Response) {
    const { conversations, meta } = await chatService.listConversations(
      req.user!.id,
      req.query as unknown as ListQuery,
    );
    sendSuccess(res, conversations, { meta });
  },

  async listMessages(req: Request, res: Response) {
    const { messages, meta } = await chatService.listMessages(
      req.user!.id,
      req.params.id as string,
      req.query as unknown as ListQuery,
    );
    sendSuccess(res, messages, { meta });
  },

  async sendMessage(req: Request, res: Response) {
    const result = await chatService.askQuestion(
      req.user!,
      req.params.id as string,
      req.body.content,
    );
    sendSuccess(res, result, { status: 201 });
  },

  async deleteConversation(req: Request, res: Response) {
    await chatService.deleteConversation(req.user!.id, req.params.id as string);
    sendSuccess(res, { message: 'Conversation deleted' });
  },
};
