import type { RequestHandler } from 'express';
import { UnauthorizedError, ForbiddenError } from '@/libs/errors';
import { tokenService } from './token.service';
import { userRepository } from '@/apps/users/user.repository';
import { Role } from '@/database/generated/prisma/browser';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.header('authorization')?.split(' ') ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const { userId } = await tokenService.verifyAccessToken(token);
  const user = await userRepository.getUserById(userId);
  if (!user) throw new UnauthorizedError('Account no longer exists');

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role, tier: user.tier };

  next();
};

export const requireRole =
  (...allowedRoles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError();
    if (!allowedRoles.includes(req.user.role)) throw new ForbiddenError();
    next();
  };
