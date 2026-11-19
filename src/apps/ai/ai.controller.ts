import type { Request, Response } from 'express';
import { usageService } from './usage/usage.service';
import { sendSuccess } from '@/utils/response';

export const aiController = {
  async getMyUsage(req: Request, res: Response) {
    sendSuccess(res, await usageService.getUsageSummary(req.user!));
  },
};
