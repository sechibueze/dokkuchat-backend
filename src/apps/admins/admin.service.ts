import { AdminUpdateUserInput, ListUsersQuery } from '@/apps/users/user.schema';
import { userRepository } from '../users/user.repository';
import { toAdminUserView } from '../users/user.mapper';
import { ForbiddenError, NotFoundError } from '@/libs/errors';
import { AuthenticatedUser } from '@/types/express';
import { logger } from '@/libs/logger';
import { userService } from '../users/user.service';

export const adminService = {
  async listUsers(query: ListUsersQuery) {
    const { role, ...filter } = query;
    const { items, total } = await userRepository.listUsers({ ...filter, roleName: role });
    return {
      users: items.map(toAdminUserView),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async updateUser(actor: AuthenticatedUser, userId: string, input: AdminUpdateUserInput) {
    const { role: roleName, ...fields } = input;
    if (actor.id === userId && roleName && roleName !== actor.role) {
      throw new ForbiddenError('You cannot change your own role');
    }
    if (!(await userRepository.getUserById(userId))) throw new NotFoundError('User not found');

    let roleId: string | undefined;
    if (roleName) {
      const role = await rbacRepository.getRoleByName(roleName);
      if (!role) throw new BadRequestError(`Unknown role "${roleName}"`);
      roleId = role.id;
    }

    const updated = await userRepository.updateUser(userId, {
      ...fields,
      ...(roleId && { roleId }),
    });
    await userService.invalidateUserCache(userId);
    logger.info('User updated by admin', {
      userId,
      updatedBy: actor.id,
      fields: Object.keys(input),
    });
    return toAdminUserView(updated);
  },

  async getUser(userId: string) {
    const user = await userRepository.getUserById(userId, { includeDeleted: true });
    if (!user) throw new NotFoundError('User not found');
    return toAdminUserView(user);
  },

  async softDeleteUser(actor: AuthenticatedUser, userId: string) {
    if (actor.id === userId) {
      throw new ForbiddenError('Use DELETE /users/me to delete your own account');
    }
    await userService.deleteAccount(userId);
  },

  async permanentlyDeleteUser(actor: AuthenticatedUser, userId: string) {
    if (actor.id === userId) throw new ForbiddenError('You cannot permanently delete yourself');

    if (!(await userRepository.permanentlyDeleteUser(userId))) {
      throw new NotFoundError('User not found');
    }
    logger.warn('User permanently deleted', { userId, deletedBy: actor.id });
  },
};
