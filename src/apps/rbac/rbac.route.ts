import { Router } from 'express';
import { Permission } from './rbac.catalog';
import { rbacController } from './rbac.controller';
import { createRoleSchema, roleIdParamSchema, updateRoleSchema } from './rbac.schema';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { rateLimit, rateLimitPolicies } from '@/middlewares/rate-limit.middleware';
import { validateRequest } from '@/middlewares/validate.middleware';

export const rbacRouter = Router();

rbacRouter.use(
  authenticate,
  requirePermission(Permission.RolesManage),
  rateLimit(rateLimitPolicies.admin),
);
rbacRouter.get('/roles', rbacController.listRoles);
rbacRouter.get('/permissions', rbacController.listPermissions);
rbacRouter.post('/roles', validateRequest(createRoleSchema), rbacController.createRole);
rbacRouter.patch(
  '/roles/:id',
  validateRequest(roleIdParamSchema, 'params'),
  validateRequest(updateRoleSchema),
  rbacController.updateRole,
);
rbacRouter.delete(
  '/roles/:id',
  validateRequest(roleIdParamSchema, 'params'),
  rbacController.deleteRole,
);
