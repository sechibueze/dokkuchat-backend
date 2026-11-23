import { z } from 'zod';
import { ToolApprovalStatus } from '@/database/generated/prisma/client';

export const approvalIdParamSchema = z.object({ id: z.uuid() });
export const decisionSchema = z.object({ decision: z.enum(['approve', 'reject']) });
export const listApprovalsQuerySchema = z.object({ status: z.enum(ToolApprovalStatus).optional() });
