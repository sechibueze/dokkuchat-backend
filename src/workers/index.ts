import { notificationWorker } from '@/services/notification/notification.worker';
import { getQueue } from '@/services/queue';
import { QueueName } from '@/services/queue/job.payload';
import { createWorker } from '@/services/queue/worker';
import { maintenanceWorker } from './maintenance.worker';
import { onShutdown } from '@/utils/shutdown';
import { logger } from '@/libs/logger';

async function scheduleMaintenanceJobs() {
  await getQueue(QueueName.Maintenance).upsertJobScheduler(
    'purge-expired-tokens',
    { pattern: '0 3 * * *' },
    {
      name: 'purge-expired-tokens',
      data: { task: 'purge-expired-tokens', meta: { correlationId: 'scheduler' } },
    },
  );
}

export function setupWorkers() {
  const workers = [createWorker(notificationWorker), createWorker(maintenanceWorker)];

  onShutdown('workers', async () => {
    await Promise.all(workers.map((worker) => worker.close()));
  });

  scheduleMaintenanceJobs().catch((error) =>
    logger.error('Failed to schedule maintenance jobs', { error: (error as Error).message }),
  );

  logger.info('Workers started', { queues: workers.map((worker) => worker.name) });
  return workers;
}
