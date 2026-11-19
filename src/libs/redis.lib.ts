import { env } from '@/config/env';
import { Redis } from 'ioredis';
import { logger } from './logger';
import { onShutdown } from '@/utils/shutdown';

export function bullMqConnectionOptions() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    ...(url.protocol === 'rediss:' && { tls: {} }),
  };
}

// Fail fast when Redis is down so cache and rate limiting can fail soft.
export const redis = new Redis(env.REDIS_URL, {
  connectionName: 'dokkuchat:app',
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: env.NODE_ENV === 'test',
});

redis.on('error', (error) => logger.error('Redis connection error', { error: error.message }));
onShutdown('redis', () => redis.quit());
