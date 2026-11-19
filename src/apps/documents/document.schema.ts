import { z } from 'zod';
import { DocumentStatus } from '@/database/generated/prisma/client';

export const documentIdParamSchema = z.object({ id: z.uuid() });

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(DocumentStatus).optional(),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
