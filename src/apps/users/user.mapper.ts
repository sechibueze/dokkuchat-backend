import type { User } from '@/database/generated/prisma/client';
import type { UserWithRole } from './user.repository';
import { logger } from '@/libs/logger';

export type PublicUser = Omit<User, 'password' | 'deletedAt'>;
export type AdminUserView = Omit<User, 'password'>;

export function toPublicUser(user: UserWithRole) {
  logger.info('user', user);
  const { password: _password, deletedAt: _deletedAt, legacyRole: role, ...rest } = user;
  return { ...rest, role: role };
}
export function toAdminUserView(user: UserWithRole) {
  const { password: _password, legacyRole: role, ...rest } = user;
  return { ...rest, role };
}
