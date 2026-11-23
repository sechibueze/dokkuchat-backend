import { toMessageView } from '../chat/chat.mapper';
import { agentTurnService } from '../chat/agent-turn.service';
import { toApprovalView } from './approval.mapper';
import { toolApprovalRepository } from './tool-approval.repository';
import { ToolApprovalStatus } from '@/database/generated/prisma/enums';
import { AuthenticatedUser } from '@/types/express';
import { ConflictError, NotFoundError } from '@/libs/errors';
import { appEvents } from '@/events';
import { logger } from '@/libs/logger';

const resumeIfComplete = async (messageId: string) =>
  (await toolApprovalRepository.countPending(messageId)) > 0
    ? null
    : agentTurnService.resume(messageId);

export const approvalService = {
  async listApprovals(userId: string, status?: ToolApprovalStatus) {
    return (await toolApprovalRepository.listForUser({ userId, status })).map(toApprovalView);
  },

  async decide(user: AuthenticatedUser, approvalId: string, decision: 'approve' | 'reject') {
    const approval = await toolApprovalRepository.getByIdForUser(approvalId, user.id);
    if (!approval) throw new NotFoundError('Approval request not found');
    if (approval.status !== 'PENDING')
      throw new ConflictError(`This request was already ${approval.status.toLowerCase()}`);

    if (approval.expiresAt <= new Date()) {
      if (await toolApprovalRepository.claimDecision(approval.id, 'EXPIRED', user.id)) {
        appEvents.emit('tool.approval.changed', { status: 'EXPIRED' });
        await resumeIfComplete(approval.messageId);
      }
      throw new ConflictError('This request has expired');
    }

    const status: ToolApprovalStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';
    if (!(await toolApprovalRepository.claimDecision(approval.id, status, user.id))) {
      throw new ConflictError('This request was already decided');
    }
    appEvents.emit('tool.approval.changed', { status });
    logger.info('Tool approval decided', {
      approvalId,
      decision: status,
      tool: `${approval.serverName}/${approval.toolName}`,
    });

    const message = await resumeIfComplete(approval.messageId);
    const updated = await toolApprovalRepository.getByIdForUser(approvalId, user.id);
    return { approval: toApprovalView(updated!), message: message ? toMessageView(message) : null };
  },

  /** Scheduled job: resolves approvals nobody answered so no turn waits forever. */
  async expireStaleApprovals() {
    const stale = await toolApprovalRepository.listStalePending(new Date(), 100);
    const messageIds = new Set<string>();
    for (const approval of stale) {
      if (await toolApprovalRepository.claimDecision(approval.id, 'EXPIRED')) {
        appEvents.emit('tool.approval.changed', { status: 'EXPIRED' });
        messageIds.add(approval.messageId);
      }
    }
    for (const messageId of messageIds) await resumeIfComplete(messageId);
    return stale.length;
  },
};
