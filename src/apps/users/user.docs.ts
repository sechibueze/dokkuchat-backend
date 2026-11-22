import { route } from '../docs/route-docs';
import { updateProfileSchema } from './user.schema';

const tag = 'Users';
export const userDocs = [
  route({
    method: 'get',
    path: '/users/me',
    tag,
    summary: 'My profile',
    success: { status: 200, description: 'Profile' },
  }),
  route({
    method: 'patch',
    path: '/users/me',
    tag,
    summary: 'Update my name',
    body: updateProfileSchema,
    success: { status: 200, description: 'Updated profile' },
  }),
  route({
    method: 'delete',
    path: '/users/me',
    tag,
    summary: 'Delete my account (soft delete)',
    success: { status: 200, description: 'Account deleted' },
  }),
];
