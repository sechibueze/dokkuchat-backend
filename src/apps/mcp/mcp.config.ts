import { env } from '@/config/env';
import { z } from 'zod';

const serverSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/, 'Use lowercase letters, digits and hyphens'),
  url: z.url(),
  headers: z.record(z.string(), z.string()).default({}),
  /** Read-only tools that may run without asking the user. Everything else needs approval. */
  autoApproveTools: z.array(z.string()).default([]),
});
export type McpServerConfig = z.infer<typeof serverSchema>;

export function loadMcpServerConfigs(raw: string): McpServerConfig[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('MCP_CLIENT_SERVERS must be valid JSON');
  }
  const result = z.array(serverSchema).safeParse(parsed);
  if (!result.success)
    throw new Error(`Invalid MCP_CLIENT_SERVERS: ${result.error.issues[0]?.message}`);
  return result.data;
}

export const mcpServerConfigs = loadMcpServerConfigs(env.MCP_CLIENT_SERVERS);

export const APPROVAL_TTL_MS = 15 * 60 * 1000;
export const TOOL_TIMEOUT_MS = 20_000;
export const MAX_TOOL_CALLS_PER_TURN = 3;
export const MAX_TOOL_RESULT_CHARS = 8_000;
