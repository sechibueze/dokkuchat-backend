import type { Request, Response } from 'express';
import type { UpdateProfileInput } from './user.schema';
import { userService } from './user.service';
import { sendSuccess } from '@/utils/response';

export const userController = {
  async getMyProfile(req: Request, res: Response) {
    sendSuccess(res, await userService.getProfile(req.user!.id));
  },

  async updateMyProfile(req: Request, res: Response) {
    sendSuccess(res, await userService.updateProfile(req.user!.id, req.body as UpdateProfileInput));
  },

  async deleteMyAccount(req: Request, res: Response) {
    await userService.deleteAccount(req.user!.id);
    sendSuccess(res, { message: 'Your account has been deleted' });
  },
};
