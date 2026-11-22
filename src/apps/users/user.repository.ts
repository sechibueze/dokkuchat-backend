import { db, type Tx } from '@/database';
import type { Prisma, Role, Tier } from '@/database/generated/prisma/client';
import { SystemRole } from '../rbac/rbac.catalog';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  tier?: Tier;
  roleName?: string;
}
export interface UpdateUserData {
  name?: string;
  password?: string;
  tier?: Tier;
  roleId?: string;
}
export interface ListUsersFilter {
  page: number;
  limit: number;
  search?: string;
  roleName?: string;
  tier?: Tier;
  includeDeleted?: boolean;
}

export type UserWithRole = Prisma.UserGetPayload<{ include: typeof withRole }>;
const withRole = { role: true } as const;
const excludeSoftDeleted = { deletedAt: null } as const;

export const userRepository = {
  createUser({ roleName = SystemRole.User, ...data }: CreateUserData, tx: Tx = db) {
    return tx.user.create({
      data: { ...data, role: { connect: { name: roleName } } },
      include: withRole,
    });
  },

  getUserById(id: string, options: { includeDeleted?: boolean } = {}, tx: Tx = db) {
    return tx.user.findFirst({
      where: { id, ...(options.includeDeleted ? {} : excludeSoftDeleted) },
    });
  },

  getUserByEmail(email: string, tx: Tx = db) {
    return tx.user.findFirst({ where: { email, ...excludeSoftDeleted } });
  },

  updateUser(id: string, data: UpdateUserData, tx: Tx = db) {
    return tx.user.update({ where: { id, ...excludeSoftDeleted }, data });
  },

  /** Marks the row deleted and rewrites the email so the address can be registered again. */
  async softDeleteUser(id: string, tx: Tx = db): Promise<boolean> {
    const user = await tx.user.findFirst({
      where: { id, ...excludeSoftDeleted },
      select: { email: true },
    });
    if (!user) return false;

    await tx.user.update({
      where: { id },
      data: { deletedAt: new Date(), email: `deleted_${Date.now()}_${user.email}` },
    });
    return true;
  },

  async permanentlyDeleteUser(id: string, tx: Tx = db): Promise<boolean> {
    const { count } = await tx.user.deleteMany({ where: { id } });
    return count > 0;
  },

  async listUsers(filter: ListUsersFilter, tx: Tx = db) {
    const { page, limit, search, roleName, tier, includeDeleted } = filter;
    const where: Prisma.UserWhereInput = {
      ...(includeDeleted ? {} : excludeSoftDeleted),
      ...(roleName && { role: { name: roleName } }),
      ...(tier && { tier }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      tx.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      tx.user.count({ where }),
    ]);
    return { items, total };
  },

  getUserForAuthentication(id: string, tx: Tx = db) {
    return tx.user.findFirst({
      where: { id, ...excludeSoftDeleted },
      include: {
        role: {
          include: {
            permissions: {
              where: { deletedAt: null },
              select: { permission: { select: { key: true } } },
            },
          },
        },
      },
    });
  },
};
