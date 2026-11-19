import { logger } from '@/libs/logger';
import { QueueName } from '../queue/job.payload';
import { WorkerDefinition } from '../queue/worker';
import { env } from '@/config/env';

export const notificationWorker: WorkerDefinition<typeof QueueName.Notifications> = {
  queue: QueueName.Notifications,
  concurrency: 5,
  async process(_jobName, job) {
    switch (job.type) {
      case 'password-reset-email':
        logger.info('Password reset email (simulated)', {
          to: job.to,
          ...(env.NODE_ENV !== 'production' && { resetUrl: job.resetUrl }), // the link is a credential
        });
        break;
      case 'document-ready-email':
        logger.info('Document ready email (simulated)', { to: job.to, document: job.documentName });
        break;
    }
  },
};
