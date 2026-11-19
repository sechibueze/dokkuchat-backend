import { db } from '@/database';
import { redis } from '@/libs/redis.lib';
import { getQueue } from '@/services/queue';
import { QueueName } from '@/services/queue/job.payload';
import { fileStorage } from '@/services/storage/storage.factory';

type CheckFn = () => Promise<void>;

export interface CheckResult {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

const CHECK_TIMEOUT_MS = 2_000;
const checks = new Map<string, CheckFn>();

export function registerHealthCheck(name: string, fn: CheckFn) {
  checks.set(name, fn);
}

registerHealthCheck('database', async () => {
  await db.$queryRaw`SELECT 1`;
});

registerHealthCheck('redis', async () => {
  await redis.ping();
});
registerHealthCheck('queues', async () => {
  await getQueue(QueueName.DocumentIngestion).getJobCounts('waiting');
});
registerHealthCheck('storage', async () => {
  // validates credentials and bucket without writing
  await fileStorage.fileExists('healthcheck/.probe');
});

function withTimeout(promise: Promise<void>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function runReadinessChecks() {
  const entries = await Promise.all(
    [...checks].map(async ([name, fn]): Promise<[string, CheckResult]> => {
      const start = Date.now();
      try {
        await withTimeout(fn(), CHECK_TIMEOUT_MS);
        return [name, { status: 'up', latencyMs: Date.now() - start }];
      } catch (err) {
        return [
          name,
          {
            status: 'down',
            latencyMs: Date.now() - start,
            error: (err as Error).message,
          },
        ];
      }
    }),
  );
  const results = Object.fromEntries(entries);
  const healthy = entries.every(([, r]) => r.status === 'up');
  return { healthy, checks: results };
}
