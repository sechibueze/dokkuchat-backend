import { randomUUID } from 'node:crypto';
import { UnrecoverableError, Worker, type Job } from 'bullmq';
import { QUEUE_PREFIX, QueueName } from '.';
import { JobMeta, JobPayloads } from './job.payload';
import { logger } from '@/libs/logger';
import { bullMqConnectionOptions } from '@/libs/redis.lib';
import { appEvents } from '@/events';

export interface WorkerDefinition<Q extends QueueName> {
  queue: Q;
  concurrency: number;
  process: (jobName: string, payload: JobPayloads[Q], job: Job) => Promise<void>;
  /** Runs once, after the last retry (or an UnrecoverableError). */
  onFinalFailure?: (payload: JobPayloads[Q], error: Error) => Promise<void>;
}

function splitJobData<Q extends QueueName>(job: Job) {
  const { meta, ...payload } = job.data as { meta?: JobMeta } & Record<string, unknown>;
  return { meta, payload: payload as unknown as JobPayloads[Q] };
}

const contextOf = (meta?: JobMeta) => ({
  correlationId: meta?.correlationId ?? randomUUID(),
  userId: meta?.userId,
});

export function createWorker<Q extends QueueName>(definition: WorkerDefinition<Q>): Worker {
  const worker = new Worker(
    definition.queue,
    async (job) => {
      const { meta, payload } = splitJobData<Q>(job);
      logger.info('Job started', {
        queue: definition.queue,
        job: job.name,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      });
      return await definition.process(job.name, payload, job);
    },
    {
      prefix: QUEUE_PREFIX,
      concurrency: definition.concurrency,
      connection: { ...bullMqConnectionOptions(), maxRetriesPerRequest: null },
    },
  );

  worker.on('completed', (job) => {
    appEvents.emit('job.completed', {
      queue: definition.queue,
      jobName: job.name,
      jobId: job.id,
      attempt: job.attemptsMade,
      durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : undefined,
    });
  });

  worker.on('failed', async (job, error) => {
    if (!job) return;
    const { meta, payload } = splitJobData<Q>(job);
    appEvents.emit('job.failed', {
      queue: definition.queue,
      jobName: job.name,
      jobId: job.id,
      attempt: job.attemptsMade,
      error: error.message,
    });

    const exhausted =
      error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1);
    if (exhausted && definition.onFinalFailure) {
      try {
        await definition.onFinalFailure(payload, error);
      } catch (handlerError) {
        logger.error('onFinalFailure handler failed', { error: (handlerError as Error).message });
      }
    }
  });

  worker.on('error', (error) =>
    logger.error('Worker error', { queue: definition.queue, error: error.message }),
  );
  return worker;
}
