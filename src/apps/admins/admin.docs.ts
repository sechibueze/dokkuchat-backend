import { route } from '../docs/route-docs';
import {
  adminUpdateUserSchema,
  listUsersQuerySchema,
  userIdParamSchema,
} from '../users/user.schema';

const tag = 'Admin';
export const adminDocs = [
  route({
    method: 'get',
    path: '/admins/users',
    tag,
    summary: 'List users',
    permission: 'users:read',
    limited: true,
    query: listUsersQuerySchema,
    success: { status: 200, description: 'Paginated users' },
  }),
  route({
    method: 'get',
    path: '/admins/users/{id}',
    tag,
    summary: 'Get a user',
    permission: 'users:read',
    params: userIdParamSchema,
    success: { status: 200, description: 'User' },
  }),
  route({
    method: 'patch',
    path: '/admins/users/{id}',
    tag,
    summary: 'Update name, role or tier',
    permission: 'users:write',
    params: userIdParamSchema,
    body: adminUpdateUserSchema,
    success: { status: 200, description: 'Updated user' },
  }),
  route({
    method: 'delete',
    path: '/admins/users/{id}',
    tag,
    summary: 'Soft delete a user',
    permission: 'users:delete',
    params: userIdParamSchema,
    success: { status: 200, description: 'User deleted' },
  }),
  route({
    method: 'delete',
    path: '/admins/users/{id}/permanent',
    tag,
    summary: 'Permanently delete a user',
    permission: 'users:delete-permanent',
    params: userIdParamSchema,
    success: { status: 200, description: 'User removed' },
  }),
];
