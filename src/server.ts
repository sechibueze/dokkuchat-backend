import { createApp } from './app';
import { env } from '@/config/env';
import { logger } from '@/libs/logger';
import { db } from '@/database';
import { setupWorkers } from './workers';
import { registerAppEventListeners } from './events/listener';
import { runShutdownHooks } from './utils/shutdown';
import { registerMetricListeners } from './observability/metric-listener';

registerAppEventListeners();
registerMetricListeners();
if (env.RUN_WORKERS) setupWorkers();
const app = createApp();
const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`API listening on port ${env.PORT}`, { env: env.NODE_ENV });
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  const force = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  force.unref();

  server.close(async () => {
    await runShutdownHooks();
    await db.$disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { reason }));
