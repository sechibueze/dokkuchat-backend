import { NotificationJob, QueueName } from '@/services/queue/job.payload';
import { enqueueJob } from '../queue';
import { logger } from '@/libs/logger';

async function enqueueNotification(job: NotificationJob) {
  try {
    await enqueueJob(QueueName.Notifications, 'send-notification', job);
  } catch (error) {
    logger.error('Failed to enqueue notification', {
      type: job.type,
      error: (error as Error).message,
    });
  }
}

export const notificationService = {
  sendPasswordResetEmail(params: { to: string; name: string; resetUrl: string }) {
    return enqueueNotification({ type: 'password-reset-email', ...params });
  },
  sendDocumentReadyEmail(params: { to: string; name: string; documentName: string }) {
    return enqueueNotification({ type: 'document-ready-email', ...params });
  },
};
