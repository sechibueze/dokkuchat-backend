import { sendSuccess } from '@/utils/response';
import { approvalService } from './approval.service';
import { mcpClientRegistry } from '../mcp/client/mcp-client.registry';
import { Request, Response } from 'express';

export const approvalController = {
  async list(req: Request, res: Response) {
    sendSuccess(
      res,
      await approvalService.listApprovals(
        req.user!.id,
        (req.query as { status?: ToolApprovalStatus }).status,
      ),
    );
  },
  async decide(req: Request, res: Response) {
    sendSuccess(
      res,
      await approvalService.decide(req.user!, req.params.id as string, req.body.decision),
    );
  },
  async listTools(_req: Request, res: Response) {
    const tools = await mcpClientRegistry.listTools();
    sendSuccess(
      res,
      tools.map(({ serverName, toolName, description, autoApprove }) => ({
        server: serverName,
        tool: toolName,
        description,
        autoApprove,
      })),
    );
  },
};
