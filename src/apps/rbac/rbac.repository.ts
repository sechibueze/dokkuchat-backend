import { db, type Tx } from '@/database';
import type { Prisma } from '@/database/generated/prisma/client';

const withPermissions = { permissions: { include: { permission: true } } } as const;
export type RoleWithPermissions = Prisma.RoleGetPayload<{ include: typeof withPermissions }>;

export const rbacRepository = {
  listRoles(tx: Tx = db) {
    return tx.role.findMany({ include: withPermissions, orderBy: { name: 'asc' } });
  },
  getRoleById(id: string, tx: Tx = db) {
    return tx.role.findUnique({ where: { id }, include: withPermissions });
  },
  getDefaultRole(tx: Tx = db) {
    return tx.role.findFirst({ where: { isDefault: true }, include: withPermissions });
  },
  getRoleByName(name: string, tx: Tx = db) {
    return tx.role.findUnique({ where: { name }, include: withPermissions });
  },
  createRole(data: { name: string; description?: string }, tx: Tx = db) {
    return tx.role.create({ data });
  },
  updateRole(id: string, data: { description?: string }, tx: Tx = db) {
    return tx.role.update({ where: { id }, data });
  },
  async deleteRole(id: string, tx: Tx = db) {
    const { count } = await tx.role.deleteMany({ where: { id } });
    return count > 0;
  },
  countUsersWithRole(roleId: string, tx: Tx = db) {
    return tx.user.count({ where: { roleId, deletedAt: null } });
  },
  listPermissions(tx: Tx = db) {
    return tx.permission.findMany({ orderBy: { key: 'asc' } });
  },
  async getPermissionKeysForRole(roleId: string, tx: Tx = db) {
    const rows = await tx.rolePermission.findMany({
      where: { roleId, deletedAt: null },
      select: { permission: { select: { key: true } } },
    });
    return rows.map((row) => row.permission.key);
  },
  async replaceRolePermissions(roleId: string, keys: string[], tx: Tx = db) {
    const permissions = await tx.permission.findMany({ where: { key: { in: keys } } });
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    });
  },
  async addPermissionsToRole(roleId: string, keys: string[], tx: Tx = db) {
    const permissions = await tx.permission.findMany({ where: { key: { in: keys } } });
    await tx.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    });
  },
  upsertPermission(key: string, description: string, tx: Tx = db) {
    return tx.permission.upsert({
      where: { key },
      create: { key, description },
      update: { description },
    });
  },
  upsertRole(
    name: string,
    description: string,
    isDefault: boolean = false,
    isSystem: boolean = false,
    tx: Tx = db,
  ) {
    return tx.role.upsert({
      where: { name },
      create: { name, description, isSystem, isDefault },
      update: { description, isSystem, isDefault },
    });
  },
};
