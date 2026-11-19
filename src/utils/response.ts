import type { Response } from 'express';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  correlationId?: string;
}

export interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
  correlationId?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  opts: { status?: number; meta?: Record<string, unknown> } = {},
) {
  const body: SuccessEnvelope<T> = {
    success: true,
    data,
    ...(opts.meta && { meta: opts.meta }),
    correlationId: (res.getHeader('X-Correlation-ID') as string) ?? '',
  };
  return res.status(opts.status ?? 200).json(body);
}

export function sendError(
  res: Response,
  status: number,
  error: ErrorEnvelope['error'],
) {
  const body: ErrorEnvelope = {
    success: false,
    error,
    correlationId: (res.getHeader('X-Correlation-ID') as string) ?? '',
  };
  return res.status(status).json(body);
}
