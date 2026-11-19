import type { User } from '@/database/generated/prisma/client';

export type PublicUser = Omit<User, 'password' | 'deletedAt'>;
export type AdminUserView = Omit<User, 'password'>;

export function toPublicUser(user: User): PublicUser {
  const { password: _password, deletedAt: _deletedAt, ...rest } = user;
  return rest;
}

export function toAdminUserView(user: User): AdminUserView {
  const { password: _password, ...rest } = user;
  return rest;
}
