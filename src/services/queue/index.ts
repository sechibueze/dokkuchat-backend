import { Queue, type JobsOptions } from 'bullmq';
import type { JobPayloads, QueueName } from './job.payload';
import { bullMqConnectionOptions } from '@/libs/redis.lib';
import { onShutdown } from '@/utils/shutdown';

export { QueueName };

export const QUEUE_PREFIX = 'dokkuchat';

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      prefix: QUEUE_PREFIX,
      connection: { ...bullMqConnectionOptions(), maxRetriesPerRequest: 1 },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 3_600, count: 1_000 },
        removeOnFail: { age: 7 * 24 * 3_600 },
      },
    });
    queue.on('error', () => undefined); // connection errors are already logged by the Redis client
    queues.set(name, queue);
  }
  return queue;
}

export function enqueueJob<Q extends QueueName>(
  queue: Q,
  jobName: string,
  payload: JobPayloads[Q],
  options: JobsOptions = {},
) {
  return getQueue(queue).add(jobName, { ...payload }, options);
}

onShutdown('queues', async () => {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
});
