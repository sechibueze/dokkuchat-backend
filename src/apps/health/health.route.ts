import { Router } from 'express';
import { runReadinessChecks } from '@/apps/health/health.service';
import { sendSuccess } from '@/utils/response';
import { ServiceUnavailableError } from '@/libs/errors';

export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  sendSuccess(res, {
    status: 'alive',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

healthRouter.get('/ready', async (_req, res) => {
  const { healthy, checks } = await runReadinessChecks();
  if (!healthy)
    throw new ServiceUnavailableError(
      'One or more dependencies are unhealthy',
      checks,
    );
  sendSuccess(res, { status: 'ready', checks });
});
