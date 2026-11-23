import type { ToolApproval } from '@/database/generated/prisma/client';

/** The user sees exactly what will run, with which arguments. */
export const toApprovalView = (approval: ToolApproval) => ({
  id: approval.id,
  messageId: approval.messageId,
  server: approval.serverName,
  tool: approval.toolName,
  arguments: approval.arguments,
  status: approval.status,
  autoApproved: approval.autoApproved,
  expiresAt: approval.expiresAt,
  createdAt: approval.createdAt,
});
