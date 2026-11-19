import { healthRouter } from '@/apps/health/health.route';
import { Router } from 'express';

export const routes = Router();

const v1 = Router();
routes.use('/api/v1', v1);
v1.use('/health', healthRouter);
