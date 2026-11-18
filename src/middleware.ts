import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '@/libs/logger';
import { HttpError, InternalServerError, NotFoundError } from './libs/errors';
import { env } from './config/env';
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.http('request completed', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
    });
  });
  next();
};

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;

  const status = (err as { status?: unknown })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
    return new HttpError((err as Error).message || 'Bad request', status, code);
  }
  return new InternalServerError(undefined, err);
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const httpError = toHttpError(err);
  const logMeta = {
    method: req.method,
    path: req.originalUrl,
    status: httpError.statusCode,
    code: httpError.code,
  };

  if (httpError.statusCode >= 500) {
    logger.error(err instanceof Error ? err.message : 'Unhandled error', {
      ...logMeta,
      stack: err?.stack,
    });
  } else {
    logger.warn(httpError.message, logMeta);
  }

  const expose = httpError.isOperational || env.NODE_ENV !== 'production';

  return res.status(httpError.statusCode ?? 500).json({
    success: false,
    errors: {
      code: httpError.code,
      message: expose ? httpError.message : 'Internal server error',
      ...(expose &&
        httpError.details !== undefined && { details: httpError.details }),
    },
  });
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
};
