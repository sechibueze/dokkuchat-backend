import type { UpdateProfileInput } from './user.schema';
import { toPublicUser } from './user.mapper';
import { userRepository } from './user.repository';
import { NotFoundError } from '@/libs/errors';
import { db } from '@/database';
import { accessTokenRepository } from '../auth/access-token.repository';
import { logger } from '@/libs/logger';

export const userService = {
  async getProfile(userId: string) {
    const user = await userRepository.getUserById(userId);
    if (!user) throw new NotFoundError('User not found');
    return toPublicUser(user);
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const existing = await userRepository.getUserById(userId);
    if (!existing) throw new NotFoundError('User not found');

    const updated = await userRepository.updateUser(userId, { name: input.name });
    return toPublicUser(updated);
  },

  /** Soft delete: frees the email address and signs the user out everywhere, atomically. */
  async deleteAccount(userId: string) {
    await db.$transaction(async (tx) => {
      if (!(await userRepository.softDeleteUser(userId, tx))) {
        throw new NotFoundError('User not found');
      }
      await accessTokenRepository.revokeAllForUser(userId, tx);
    });
    logger.info('User soft deleted', { userId });
  },
};
