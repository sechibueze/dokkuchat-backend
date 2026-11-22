import { route } from '../docs/route-docs';
import { createRoleSchema, updateRoleSchema } from './rbac.schema';

const tag = 'Roles and permissions';
export const rbacDocs = [
  route({
    method: 'get',
    path: '/rbac/roles',
    tag,
    summary: 'Get roles',
    success: { status: 200 },
  }),
  route({
    method: 'post',
    path: '/rbac/roles',
    body: createRoleSchema,
    tag,
    summary: 'Craete roles',
    success: { status: 201 },
  }),
];
