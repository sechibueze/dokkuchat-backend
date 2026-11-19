import type { Role, Tier } from '../database/generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tier: Tier;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
