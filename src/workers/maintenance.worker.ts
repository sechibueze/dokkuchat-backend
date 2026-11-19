import { accessTokenRepository } from '@/apps/auth/access-token.repository';
import { logger } from '@/libs/logger';
import { QueueName } from '@/services/queue/job.payload';
import { WorkerDefinition } from '@/services/queue/worker';

export const maintenanceWorker: WorkerDefinition<typeof QueueName.Maintenance> = {
  queue: QueueName.Maintenance,
  concurrency: 1,
  async process(_jobName, job) {
    if (job.task === 'purge-expired-tokens') {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [accessTokens] = await Promise.all([accessTokenRepository.deleteExpiredTokens(cutoff)]);
      logger.info('Expired tokens purged', { accessTokens });
    }
  },
};
