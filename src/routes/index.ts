import { adminRouter } from '@/apps/admins/admin.route';
import { authRouter } from '@/apps/auth/auth.route';
import { healthRouter } from '@/apps/health/health.route';
import { userRouter } from '@/apps/users/user.route';
import { Router } from 'express';

export const routes = Router();

const v1 = Router();
routes.use('/api/v1', v1);
v1.use('/auth', authRouter);
v1.use('/users', userRouter);
v1.use('/admins', adminRouter);
v1.use('/health', healthRouter);
