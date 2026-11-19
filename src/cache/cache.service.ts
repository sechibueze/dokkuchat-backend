import { createHash } from 'node:crypto';
import { redis } from '@/libs/redis.lib';
import { logger } from '@/libs/logger';
const KEY_PREFIX = 'dokkuchat:cache:';
const TAG_PREFIX = 'dokkuchat:cache-tag:';
const MAX_TTL_SECONDS = 24 * 60 * 60;

export interface CacheWriteOptions {
  ttlSeconds: number;
  tags?: string[];
}

const entryKey = (key: string) => `${KEY_PREFIX}${key}`;
const tagKey = (tag: string) => `${TAG_PREFIX}${tag}`;
const inflight = new Map<string, Promise<unknown>>();

async function failSoft<T>(operation: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    logger.warn('Cache operation failed', { operation, error: (error as Error).message });
    return fallback;
  }
}

export const hashKeyPart = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

export const Cache = {
  get<T>(key: string): Promise<T | undefined> {
    return failSoft('get', undefined, async () => {
      const raw = await redis.get(entryKey(key));
      return raw === null ? undefined : (JSON.parse(raw) as { value: T }).value;
    });
  },

  async set<T>(key: string, value: T, { ttlSeconds, tags = [] }: CacheWriteOptions): Promise<void> {
    await failSoft('set', undefined, async () => {
      const ttl = Math.min(Math.max(1, ttlSeconds), MAX_TTL_SECONDS);
      const pipeline = redis.multi().set(entryKey(key), JSON.stringify({ value }), 'EX', ttl);
      for (const tag of tags) {
        pipeline.sadd(tagKey(tag), entryKey(key)).expire(tagKey(tag), MAX_TTL_SECONDS);
      }
      await pipeline.exec();
    });
  },

  async delete(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await failSoft('delete', undefined, async () => {
      await redis.del(...keys.map(entryKey));
    });
  },

  async invalidateTags(...tags: string[]): Promise<void> {
    await failSoft('invalidateTags', undefined, async () => {
      for (const tag of tags) {
        const members = await redis.smembers(tagKey(tag));
        if (members.length > 0) await redis.del(...members);
        await redis.del(tagKey(tag));
      }
    });
  },

  /** Logical keys (prefix stripped) matching a glob pattern. */
  scanKeys(pattern: string): Promise<string[]> {
    return failSoft('scan', [], async () => {
      const found: string[] = [];
      for await (const batch of redis.scanStream({ match: entryKey(pattern), count: 200 })) {
        found.push(...(batch as string[]).map((key) => key.slice(KEY_PREFIX.length)));
      }
      return found;
    });
  },

  async getOrSet<T>(key: string, options: CacheWriteOptions, loader: () => Promise<T>): Promise<T> {
    const cached = await Cache.get<T>(key);
    if (cached !== undefined) return cached;

    const pending = inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const load = (async () => {
      const value = await loader();
      if (value !== undefined) await Cache.set(key, value, options);
      return value;
    })().finally(() => inflight.delete(key));

    inflight.set(key, load);
    return load;
  },
};
