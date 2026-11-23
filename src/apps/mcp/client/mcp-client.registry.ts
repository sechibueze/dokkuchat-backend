import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import {
  MAX_TOOL_RESULT_CHARS,
  mcpServerConfigs,
  TOOL_TIMEOUT_MS,
  type McpServerConfig,
} from '../mcp.config';
import { onShutdown } from '@/utils/shutdown';
import { logger } from '@/libs/logger';
import { appEvents } from '@/events';

export interface McpToolEntry {
  serverName: string;
  toolName: string;
  /** The name the model sees: `<server>__<tool>`, safe for function calling. */
  functionName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  autoApprove: boolean;
}

const CATALOG_TTL_MS = 5 * 60 * 1000;
const toFunctionName = (server: string, tool: string) =>
  `${server}__${tool}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);

export class McpClientRegistry {
  private readonly connections = new Map<string, Promise<Client>>();
  private catalog?: { entries: McpToolEntry[]; loadedAt: number };

  constructor(private readonly servers: McpServerConfig[]) {
    onShutdown('mcp-clients', async () => {
      await Promise.allSettled(
        [...this.connections.values()].map(async (connection) => (await connection).close()),
      );
    });
  }

  private connect(config: McpServerConfig) {
    let connection = this.connections.get(config.name);
    if (!connection) {
      connection = (async () => {
        const client = new Client({ name: 'dokkuchat', version: '1.0.0' });
        await client.connect(
          new StreamableHTTPClientTransport(new URL(config.url), {
            requestInit: { headers: config.headers },
          }),
        );
        return client;
      })();
      connection.catch(() => this.connections.delete(config.name));
      this.connections.set(config.name, connection);
    }
    return connection;
  }

  async listTools(): Promise<McpToolEntry[]> {
    if (this.catalog && Date.now() - this.catalog.loadedAt < CATALOG_TTL_MS)
      return this.catalog.entries;

    const entries: McpToolEntry[] = [];
    let complete = true;
    await Promise.all(
      this.servers.map(async (config) => {
        try {
          const { tools } = await (await this.connect(config)).listTools();
          for (const tool of tools) {
            entries.push({
              serverName: config.name,
              toolName: tool.name,
              functionName: toFunctionName(config.name, tool.name),
              description: tool.description ?? tool.name,
              inputSchema: tool.inputSchema as Record<string, unknown>,
              autoApprove: config.autoApproveTools.includes(tool.name),
            });
          }
        } catch (error) {
          complete = false; // a broken server must never block chat
          this.connections.delete(config.name);
          logger.warn('MCP server unavailable', {
            server: config.name,
            error: (error as Error).message,
          });
        }
      }),
    );
    if (complete) this.catalog = { entries, loadedAt: Date.now() };
    return entries;
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const config = this.servers.find((server) => server.name === serverName);
    if (!config) throw new Error(`Unknown MCP server "${serverName}"`);

    const startedAt = performance.now();
    let outcome: 'success' | 'error' = 'error';
    try {
      const client = await this.connect(config);
      const result = await client.callTool({ name: toolName, arguments: args }, undefined, {
        timeout: TOOL_TIMEOUT_MS,
      });
      const text = (result.content as { type: string; text?: string }[])
        .map((part) =>
          part.type === 'text' ? (part.text ?? '') : `[${part.type} content omitted]`,
        )
        .join('\n');
      if (result.isError) throw new Error(text || 'The tool reported an error');
      outcome = 'success';
      return text.length > MAX_TOOL_RESULT_CHARS
        ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n[truncated]`
        : text;
    } catch (error) {
      this.connections.delete(serverName); // reconnect on the next call
      throw error;
    } finally {
      appEvents.emit('tool.call.completed', {
        server: serverName,
        tool: toolName,
        outcome,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  }
}

export const mcpClientRegistry = new McpClientRegistry(mcpServerConfigs);
