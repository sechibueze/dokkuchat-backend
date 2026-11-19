import { adminRouter } from '@/apps/admins/admin.route';
import { aiRouter } from '@/apps/ai/ai.route';
import { authRouter } from '@/apps/auth/auth.route';
import { chatRouter } from '@/apps/chat/chat.route';
import { documentRouter } from '@/apps/documents/document.route';
import { healthRouter } from '@/apps/health/health.route';
import { userRouter } from '@/apps/users/user.route';
import { Router } from 'express';

export const routes = Router();

const v1 = Router();
routes.use('/api/v1', v1);
v1.use('/auth', authRouter);
v1.use('/users', userRouter);
v1.use('/admins', adminRouter);
v1.use('/ai', aiRouter);
v1.use('/documents', documentRouter);
v1.use('/conversations', chatRouter);
v1.use('/health', healthRouter);
