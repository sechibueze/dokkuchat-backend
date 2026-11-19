import { createHash } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { RateLimiterMemory, RateLimiterRedis, type RateLimiterRes } from 'rate-limiter-flexible';
import { redis } from '@/libs/redis.lib';
import { logger } from '@/libs/logger';
import { TooManyRequestsError } from '@/libs/errors';
import type { Tier } from '@/database/generated/prisma/client';

export interface RateLimitPolicy {
  name: string;
  points: number | Record<Tier, number>;
  durationSeconds: number;
  blockDurationSeconds?: number;
  keyBy: 'ip' | 'user' | 'ip+email';
}

export const rateLimitPolicies = {
  global: { name: 'global', points: 300, durationSeconds: 60, keyBy: 'ip' },
  login: {
    name: 'login',
    points: 10,
    durationSeconds: 900,
    blockDurationSeconds: 900,
    keyBy: 'ip+email',
  },
  register: { name: 'register', points: 5, durationSeconds: 3600, keyBy: 'ip' },
  forgotPassword: { name: 'forgot-password', points: 3, durationSeconds: 3600, keyBy: 'ip+email' },
  resetPassword: { name: 'reset-password', points: 5, durationSeconds: 900, keyBy: 'ip' },
  refreshToken: { name: 'refresh-token', points: 30, durationSeconds: 900, keyBy: 'ip' },
  documentUpload: { name: 'document-upload', points: 20, durationSeconds: 3600, keyBy: 'user' },
  chatMessage: {
    name: 'chat-message',
    points: { FREE: 10, PRO: 30, ENTERPRISE: 100 },
    durationSeconds: 60,
    keyBy: 'user',
  },
  admin: { name: 'admin', points: 120, durationSeconds: 60, keyBy: 'user' },
} satisfies Record<string, RateLimitPolicy>;

const limiters = new Map<string, RateLimiterRedis>();

function getLimiter(policy: RateLimitPolicy, points: number) {
  const id = `${policy.name}:${points}`;
  let limiter = limiters.get(id);
  if (!limiter) {
    limiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: `dokkuchat:rl:${id}`,
      points,
      duration: policy.durationSeconds,
      blockDuration: policy.blockDurationSeconds,
      insuranceLimiter: new RateLimiterMemory({ points, duration: policy.durationSeconds }),
    });
    limiters.set(id, limiter);
  }
  return limiter;
}

function resolveKey(req: Request, policy: RateLimitPolicy) {
  const ip = req.ip ?? 'unknown';
  if (policy.keyBy === 'user') return req.user?.id ?? ip;
  if (policy.keyBy === 'ip+email') {
    const email = String(req.body?.email ?? '')
      .trim()
      .toLowerCase();
    return `${ip}:${createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
  }
  return ip;
}

function setHeaders(res: Response, limit: number, result: RateLimiterRes) {
  res.set({
    'RateLimit-Limit': String(limit),
    'RateLimit-Remaining': String(result.remainingPoints),
    'RateLimit-Reset': String(Math.ceil(result.msBeforeNext / 1000)),
  });
}

export const rateLimit =
  (policy: RateLimitPolicy): RequestHandler =>
  async (req, res, next) => {
    const points =
      typeof policy.points === 'number' ? policy.points : policy.points[req.user?.tier ?? 'FREE'];
    const limiter = getLimiter(policy, points);

    let result: RateLimiterRes;
    try {
      result = await limiter.consume(resolveKey(req, policy));
    } catch (rejection) {
      if (rejection instanceof Error) {
        logger.error('Rate limiter failure; allowing request', {
          policy: policy.name,
          error: rejection.message,
        });
        return next();
      }
      const blocked = rejection as RateLimiterRes;
      const retryAfterSeconds = Math.max(1, Math.ceil(blocked.msBeforeNext / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      setHeaders(res, points, blocked);
      return next(
        new TooManyRequestsError('Too many requests, please try again later', {
          policy: policy.name,
          retryAfterSeconds,
        }),
      );
    }
    setHeaders(res, points, result);
    next();
  };
