import type { RequestHandler } from 'express';
import { UnauthorizedError, ForbiddenError } from '@/libs/errors';
import { tokenService } from './token.service';
import { Role } from '@/database/generated/prisma/browser';
import { userService } from '../users/user.service';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.header('authorization')?.split(' ') ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const { userId } = await tokenService.verifyAccessToken(token);
  const user = await userService.getAuthenticatedUser(userId);
  if (!user) throw new UnauthorizedError('Account no longer exists');

  req.user = user;

  next();
};

export const requireRole =
  (...allowedRoles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError();
    if (!allowedRoles.includes(req.user.role)) throw new ForbiddenError();
    next();
  };

export const requirePermission =
  (...required: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError();
    const missing = required.filter((permission) => !req.user!.permissions.includes(permission));
    if (missing.length > 0) {
      throw new ForbiddenError('You do not have permission to perform this action', {
        required: missing,
      });
    }
    next();
  };
