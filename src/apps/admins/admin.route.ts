import { Router } from 'express';
import { authenticate, requirePermission, requireRole } from '@/apps/auth/auth.middleware';
import { adminController } from './admin.controller';
import {
  adminUpdateUserSchema,
  listUsersQuerySchema,
  userIdParamSchema,
} from '../users/user.schema';
import { validateRequest } from '@/middlewares/validate.middleware';
import { rateLimit, rateLimitPolicies } from '@/middlewares/rate-limit.middleware';
import { Permission } from '../rbac/rbac.catalog';

export const adminRouter = Router();

adminRouter.use(authenticate, rateLimit(rateLimitPolicies.admin));

adminRouter.use(authenticate, rateLimit(rateLimitPolicies.admin));
adminRouter.get(
  '/users',
  requirePermission(Permission.UsersRead),
  validateRequest(listUsersQuerySchema, 'query'),
  adminController.listUsers,
);
adminRouter.get(
  '/users/:id',
  requirePermission(Permission.UsersRead),
  validateRequest(userIdParamSchema, 'params'),
  adminController.getUser,
);
adminRouter.patch(
  '/users/:id',
  requirePermission(Permission.UsersWrite),
  validateRequest(userIdParamSchema, 'params'),
  validateRequest(adminUpdateUserSchema),
  adminController.updateUser,
);
adminRouter.delete(
  '/users/:id',
  requirePermission(Permission.UsersDelete),
  validateRequest(userIdParamSchema, 'params'),
  adminController.softDeleteUser,
);
adminRouter.delete(
  '/users/:id/permanent',
  requirePermission(Permission.UsersDeletePermanent),
  validateRequest(userIdParamSchema, 'params'),
  adminController.permanentlyDeleteUser,
);
