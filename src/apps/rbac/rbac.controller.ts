import type { Request, Response } from 'express';
import type { CreateRoleInput, UpdateRoleInput } from './rbac.schema';
import { rbacService } from './rbac.service';
import { sendSuccess } from '@/utils/response';
export const rbacController = {
  async listRoles(_req: Request, res: Response) {
    sendSuccess(res, await rbacService.listRoles());
  },
  async listPermissions(_req: Request, res: Response) {
    sendSuccess(res, await rbacService.listPermissions());
  },
  async createRole(req: Request, res: Response) {
    sendSuccess(res, await rbacService.createRole(req.body as CreateRoleInput), { status: 201 });
  },
  async updateRole(req: Request, res: Response) {
    sendSuccess(
      res,
      await rbacService.updateRole(req.params.id as string, req.body as UpdateRoleInput),
    );
  },
  async deleteRole(req: Request, res: Response) {
    await rbacService.deleteRole(req.params.id as string);
    sendSuccess(res, { message: 'Role deleted' });
  },
};
