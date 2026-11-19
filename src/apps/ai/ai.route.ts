import { Router } from 'express';
import { aiController } from './ai.controller';
import { authenticate } from '../auth/auth.middleware';

export const aiRouter = Router();

aiRouter.use(authenticate);
aiRouter.get('/usage', aiController.getMyUsage);
