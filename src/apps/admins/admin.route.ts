import { Router } from 'express';
import { authenticate, requireRole } from '@/apps/auth/auth.middleware';
import { Role } from '@/database/generated/prisma/enums';
import { adminController } from './admin.controller';
import {
  adminUpdateUserSchema,
  listUsersQuerySchema,
  userIdParamSchema,
} from '../users/user.schema';
import { validateRequest } from '@/middlewares/validate.middleware';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole(Role.ADMIN));

adminRouter.get(
  '/users',
  validateRequest(listUsersQuerySchema, 'query'),
  adminController.listUsers,
);
adminRouter.get(
  '/users/:id',
  validateRequest(userIdParamSchema, 'params'),
  adminController.getUser,
);
adminRouter.patch(
  '/users/:id',
  validateRequest(userIdParamSchema, 'params'),
  validateRequest(adminUpdateUserSchema),
  adminController.updateUser,
);
adminRouter.delete(
  '/users/:id',
  validateRequest(userIdParamSchema, 'params'),
  adminController.softDeleteUser,
);
adminRouter.delete(
  '/users/:id/permanent',
  validateRequest(userIdParamSchema, 'params'),
  adminController.permanentlyDeleteUser,
);
