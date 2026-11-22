import { db } from '@/database';

import { Permission, SystemRole } from './rbac.catalog';
import { rbacRepository, type RoleWithPermissions } from './rbac.repository';
import type { CreateRoleInput, UpdateRoleInput } from './rbac.schema';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/libs/errors';
import { Cache } from '@/cache/cache.service';
import { logger } from '@/libs/logger';

const toRoleView = (role: RoleWithPermissions) => ({
  id: role.id,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  permissions: role.permissions.map((p) => p.permission.key).sort(),
});

function assertKnownPermissions(keys: string[]) {
  const known = new Set<string>(Object.values(Permission));
  const unknown = keys.filter((key) => !known.has(key));
  if (unknown.length > 0) throw new BadRequestError('Unknown permissions', { unknown });
}

export const rbacService = {
  async listRoles() {
    return (await rbacRepository.listRoles()).map(toRoleView);
  },

  async listPermissions() {
    return (await rbacRepository.listPermissions()).map(({ key, description }) => ({
      key,
      description,
    }));
  },

  async createRole(input: CreateRoleInput) {
    if (await rbacRepository.getRoleByName(input.name))
      throw new ConflictError('A role with this name already exists');
    assertKnownPermissions(input.permissions);

    const roleId = await db.$transaction(async (tx) => {
      const role = await rbacRepository.createRole(
        { name: input.name, description: input.description },
        tx,
      );
      await rbacRepository.replaceRolePermissions(role.id, input.permissions, tx);
      return role.id;
    });
    return toRoleView((await rbacRepository.getRoleById(roleId))!);
  },

  async updateRole(roleId: string, input: UpdateRoleInput) {
    const role = await rbacRepository.getRoleById(roleId);
    if (!role) throw new NotFoundError('Role not found');
    if (role.name === SystemRole.Admin && input.permissions) {
      throw new ForbiddenError('The ADMIN role always holds every permission');
    }
    if (input.permissions) assertKnownPermissions(input.permissions);

    await db.$transaction(async (tx) => {
      if (input.description !== undefined)
        await rbacRepository.updateRole(roleId, { description: input.description }, tx);
      if (input.permissions)
        await rbacRepository.replaceRolePermissions(roleId, input.permissions, tx);
    });
    await Cache.invalidateTags(`role:${roleId}`);
    logger.info('Role updated', { roleId, role: role.name });
    return toRoleView((await rbacRepository.getRoleById(roleId))!);
  },

  async deleteRole(roleId: string) {
    const role = await rbacRepository.getRoleById(roleId);
    if (!role) throw new NotFoundError('Role not found');
    if (role.isSystem) throw new ForbiddenError('System roles cannot be deleted');
    if ((await rbacRepository.countUsersWithRole(roleId)) > 0) {
      throw new ConflictError('Reassign users to another role before deleting this one');
    }
    await rbacRepository.deleteRole(roleId);
  },
};
