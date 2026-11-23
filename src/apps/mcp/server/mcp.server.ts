import { embeddingService } from '@/apps/ai/embeddings/embedding.service';
import { usageService } from '@/apps/ai/usage/usage.service';
import { MAX_QUESTION_CHARS, MIN_SIMILARITY } from '@/apps/chat/chat.config';
import { documentChunkRepository } from '@/apps/documents/document-chunk.repository';
import { documentService } from '@/apps/documents/document.service';
import { Permission } from '@/apps/rbac/rbac.catalog';
import { userService } from '@/apps/users/user.service';
import { ForbiddenError, HttpError } from '@/libs/errors';
import { logger } from '@/libs/logger';
import { AuthenticatedUser } from '@/types/express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';

const asText = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
});
const asError = (message: string) => ({
  isError: true,
  content: [{ type: 'text' as const, text: message }],
});

/** One server instance per request, bound to the authenticated user. */
export function createDokkuchatMcpServer(user: AuthenticatedUser) {
  const server = new McpServer({ name: 'dokkuchat', version: '1.0.0' });

  const guarded = async (permission: string, run: () => Promise<ReturnType<typeof asText>>) => {
    try {
      if (!user.permissions.includes(permission)) throw new ForbiddenError();
      return await run();
    } catch (error) {
      if (error instanceof HttpError) return asError(error.message);
      logger.error('MCP tool failed', { error: (error as Error).message });
      return asError('Internal error');
    }
  };

  server.registerTool(
    'list_documents',
    {
      title: 'List documents',
      description: "Lists the signed-in user's documents with their processing status.",
      inputSchema: {
        status: z.enum(['UPLOADED', 'PROCESSING', 'EMBEDDING', 'READY', 'FAILED']).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      },
    },
    ({ status, limit }) =>
      guarded(Permission.DocumentsRead, async () => {
        const { documents } = await documentService.listDocuments(user.id, {
          page: 1,
          limit,
          status,
        });
        return asText(documents);
      }),
  );

  server.registerTool(
    'search_documents',
    {
      title: 'Search documents',
      description:
        "Finds the passages in the user's documents that best match a question, with document names and page numbers.",
      inputSchema: {
        query: z.string().min(1).max(MAX_QUESTION_CHARS),
        limit: z.number().int().min(1).max(10).default(5),
        documentIds: z.array(z.string().uuid()).max(20).optional(),
      },
    },
    ({ query, limit, documentIds }) =>
      guarded(Permission.DocumentsRead, async () => {
        await usageService.assertWithinBudget(user);
        const embedding = await embeddingService.embedQuery(query, { userId: user.id });
        const chunks = await documentChunkRepository.searchSimilarChunks({
          userId: user.id,
          embedding,
          embeddingModel: embeddingService.activeModelId(),
          limit,
          documentIds,
        });
        return asText(
          chunks
            .filter((chunk) => chunk.similarity >= MIN_SIMILARITY)
            .map((chunk) => ({
              document: chunk.documentName,
              documentId: chunk.documentId,
              page: chunk.pageNumber,
              similarity: Math.round(chunk.similarity * 1000) / 1000,
              text: chunk.content,
            })),
        );
      }),
  );

  return server;
}
