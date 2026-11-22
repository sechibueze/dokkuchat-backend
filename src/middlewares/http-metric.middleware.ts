import { metrics } from '@/observability/metrics';
import type { RequestHandler } from 'express';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const SKIPPED = /^\/(metrics|docs)(\/|$)/;

export const httpMetrics: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0]!;
    if (SKIPPED.test(path)) return;
    // Scanners hit random URLs: all 404s share one label.
    const route = res.statusCode === 404 ? 'not_found' : path.replace(UUID, ':id');
    const labels = { method: req.method, route, status: String(res.statusCode) };
    metrics.httpServerRequests.inc(labels);
    metrics.httpServerDuration.observe(labels, Number(process.hrtime.bigint() - startedAt) / 1e9);
  });
  next();
};
