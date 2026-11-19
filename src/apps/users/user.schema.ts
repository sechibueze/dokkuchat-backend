import { Role, Tier } from '@/database/generated/prisma/enums';
import { z } from 'zod';

export const userIdParamSchema = z.object({ id: z.uuid() });

export const updateProfileSchema = z.object({ name: z.string().trim().min(2).max(100) });

export const adminUpdateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(Role).optional(),
    tier: z.enum(Tier).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  role: z.enum(Role).optional(),
  tier: z.enum(Tier).optional(),
  includeDeleted: z.stringbool().default(false),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
