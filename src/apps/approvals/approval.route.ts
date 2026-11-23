import { Router } from 'express';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { Permission } from '../rbac/rbac.catalog';
import { approvalController } from './approval.controller';
import { validateRequest } from '@/middlewares/validate.middleware';
import { approvalIdParamSchema, decisionSchema, listApprovalsQuerySchema } from './approval.schema';
import { rateLimit, rateLimitPolicies } from '@/middlewares/rate-limit.middleware';

export const approvalRouter = Router();
approvalRouter.use(authenticate, requirePermission(Permission.ToolsUse));
approvalRouter.get(
  '/',
  validateRequest(listApprovalsQuerySchema, 'query'),
  approvalController.list,
);
approvalRouter.post(
  '/:id/decision',
  rateLimit(rateLimitPolicies.approval),
  validateRequest(approvalIdParamSchema, 'params'),
  validateRequest(decisionSchema),
  approvalController.decide,
);

export const toolRouter = Router();
toolRouter.use(authenticate, requirePermission(Permission.ToolsUse));
toolRouter.get('/', approvalController.listTools);
