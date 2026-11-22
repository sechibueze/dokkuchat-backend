import { db } from '@/database';
import { PERMISSION_DESCRIPTIONS, Permission, SYSTEM_ROLES } from './rbac.catalog';
import { rbacRepository } from './rbac.repository';

/**
 * Keeps the permission catalog in step with the code. ADMIN always holds everything.
 * Other system roles get their defaults only the first time, so admin edits are never overwritten.
 */
export async function syncRbac() {
  await db.$transaction(async (tx) => {
    for (const key of Object.values(Permission)) {
      await rbacRepository.upsertPermission(key, PERMISSION_DESCRIPTIONS[key], tx);
    }
    for (const definition of SYSTEM_ROLES) {
      const role = await rbacRepository.upsertRole(
        definition.name,
        definition.description,
        definition.name === 'USER' ? true : false,
        true,
        tx,
      );
      const existing = await rbacRepository.getPermissionKeysForRole(role.id, tx);
      if (definition.alwaysSyncAll || existing.length === 0) {
        await rbacRepository.addPermissionsToRole(role.id, definition.permissions, tx);
      }
    }
  });
}
