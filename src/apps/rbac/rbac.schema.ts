import { z } from 'zod';

const roleName = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{1,39}$/, 'Use 2-40 letters, digits or underscores');

export const roleIdParamSchema = z.object({ id: z.uuid() });
export const createRoleSchema = z.object({
  name: roleName,
  description: z.string().trim().max(200).optional(),
  permissions: z.array(z.string()).default([]),
});
export const updateRoleSchema = z
  .object({
    description: z.string().trim().max(200).optional(),
    permissions: z.array(z.string()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
