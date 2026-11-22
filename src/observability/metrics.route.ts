import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { metrics, registry } from './metrics';
import { env } from '@/config/env';
import { UnauthorizedError } from '@/libs/errors';

const matchesToken = (header: string | undefined) => {
  const expected = Buffer.from(`Bearer ${env.METRICS_TOKEN}`);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
};

export const metricsRouter = Router();
metricsRouter.get('/', async (req, res) => {
  //   if (!env.METRICS_TOKEN) throw new UnauthorizedError();
  res.set('Content-Type', registry.contentType).send(await registry.metrics());
});
