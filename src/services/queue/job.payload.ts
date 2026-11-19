export const QueueName = {
  Notifications: 'notifications',
  DocumentIngestion: 'document-ingestion',
  Maintenance: 'maintenance',
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export type NotificationJob =
  | { type: 'password-reset-email'; to: string; name: string; resetUrl: string }
  | { type: 'document-ready-email'; to: string; name: string; documentName: string };

export interface DocumentIngestionJob {
  documentId: string;
  userId: string;
}

export interface MaintenanceJob {
  task: 'purge-expired-tokens';
}

export interface JobPayloads {
  notifications: NotificationJob;
  'document-ingestion': DocumentIngestionJob;
  maintenance: MaintenanceJob;
}

export interface JobMeta {
  correlationId: string;
  userId?: string;
}
