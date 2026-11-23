import { Router, type RequestHandler } from 'express';
import { McpServer as _unused } from '@modelcontextprotocol/sdk/server/mcp.js'; // remove: only the transport is needed here
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authenticate } from '../auth/auth.middleware';
import { createDokkuchatMcpServer } from './server/mcp.server';
import { rateLimit, rateLimitPolicies } from '@/middlewares/rate-limit.middleware';

export const mcpRouter = Router();

mcpRouter.post('/', authenticate, rateLimit(rateLimitPolicies.mcp), async (req, res) => {
  const server = createDokkuchatMcpServer(req.user!);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }); // stateless
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const methodNotAllowed: RequestHandler = (_req, res) => {
  res
    .status(405)
    .set('Allow', 'POST')
    .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
};
mcpRouter.get('/', methodNotAllowed);
mcpRouter.delete('/', methodNotAllowed);
