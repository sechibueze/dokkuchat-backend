import type { Request, Response } from 'express';
import { adminService } from './admin.service';
import { AdminUpdateUserInput, ListUsersQuery } from '../users/user.schema';
import { sendSuccess } from '@/utils/response';

export const adminController = {
  async listUsers(req: Request, res: Response) {
    const { users, meta } = await adminService.listUsers(req.query as unknown as ListUsersQuery);
    sendSuccess(res, users, { meta });
  },

  async getUser(req: Request, res: Response) {
    sendSuccess(res, await adminService.getUser(req.params.id as string));
  },

  async updateUser(req: Request, res: Response) {
    const updated = await adminService.updateUser(
      req.user!,
      req.params.id as string,
      req.body as AdminUpdateUserInput,
    );
    sendSuccess(res, updated);
  },

  async softDeleteUser(req: Request, res: Response) {
    await adminService.softDeleteUser(req.user!, req.params.id as string);
    sendSuccess(res, { message: 'User deleted' });
  },

  async permanentlyDeleteUser(req: Request, res: Response) {
    await adminService.permanentlyDeleteUser(req.user!, req.params.id as string);
    sendSuccess(res, { message: 'User permanently deleted' });
  },
};
