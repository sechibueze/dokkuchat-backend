import { setTimeout as sleep } from 'node:timers/promises';
import {
  isAxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import CircuitBreaker from 'opossum';

import { createHttpClient, type HttpClientOptions } from './http-client';
import { appEvents, HttpRequestEvent } from '@/events';
import { onShutdown } from '@/utils/shutdown';
import { ServiceUnavailableError, UpstreamError } from '@/libs/errors';

export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface BreakerOptions {
  errorThresholdPercentage: number;
  resetTimeoutMs: number;
  volumeThreshold: number;
}

export interface ResilientHttpClientOptions extends HttpClientOptions {
  retry?: Partial<RetryOptions>;
  breaker?: Partial<BreakerOptions>;
}

const DEFAULT_RETRY: RetryOptions = { attempts: 3, baseDelayMs: 300, maxDelayMs: 5_000 };
const DEFAULT_BREAKER: BreakerOptions = {
  errorThresholdPercentage: 50,
  resetTimeoutMs: 30_000,
  volumeThreshold: 5,
};
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const statusOf = (error: unknown) => (isAxiosError(error) ? error.response?.status : undefined);

function isRetryable(error: unknown) {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || RETRYABLE_STATUSES.has(status);
}

/** Caller mistakes must not open the circuit. */
function isIgnoredByBreaker(error: unknown) {
  const status = statusOf(error);
  return status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function classify(error: unknown): HttpRequestEvent['outcome'] {
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'timeout';
    const status = error.response?.status;
    if (status !== undefined) return status >= 500 ? 'server_error' : 'client_error';
  }
  return 'network_error';
}

export class ResilientHttpClient {
  private readonly http: AxiosInstance;
  private readonly breaker: CircuitBreaker<[AxiosRequestConfig], AxiosResponse>;
  private readonly retry: RetryOptions;

  constructor(private readonly options: ResilientHttpClientOptions) {
    this.http = createHttpClient(options);
    this.retry = { ...DEFAULT_RETRY, ...options.retry };
    const breaker = { ...DEFAULT_BREAKER, ...options.breaker };

    this.breaker = new CircuitBreaker((config: AxiosRequestConfig) => this.http.request(config), {
      name: options.name,
      timeout: false, // axios enforces the per-request timeout
      errorThresholdPercentage: breaker.errorThresholdPercentage,
      resetTimeout: breaker.resetTimeoutMs,
      volumeThreshold: breaker.volumeThreshold,
      errorFilter: isIgnoredByBreaker,
    });

    this.breaker.on('open', () => this.emitState('open'));
    this.breaker.on('halfOpen', () => this.emitState('half-open'));
    this.breaker.on('close', () => this.emitState('closed'));
    onShutdown(`http-client:${options.name}`, () => this.shutdown());
  }

  get circuitState(): 'open' | 'half-open' | 'closed' {
    if (this.breaker.opened) return 'open';
    return this.breaker.halfOpen ? 'half-open' : 'closed';
  }

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const startedAt = performance.now();
      try {
        const response = await this.breaker.fire(config);
        this.report(config, attempt, startedAt, 'success', response.status);
        return response.data as T;
      } catch (error) {
        if ((error as { code?: string }).code === 'EOPENBREAKER') {
          this.report(config, attempt, startedAt, 'circuit_open');
          throw new ServiceUnavailableError(`${this.options.name} is temporarily unavailable`);
        }

        this.report(config, attempt, startedAt, classify(error), statusOf(error));
        if (attempt >= this.retry.attempts || !isRetryable(error)) {
          throw new UpstreamError(
            `${this.options.name} request failed`,
            { upstreamStatus: statusOf(error), code: isAxiosError(error) ? error.code : undefined },
            error,
          );
        }
        await sleep(this.backoffDelayMs(attempt, error));
      }
    }
  }

  get<T>(url: string, config: AxiosRequestConfig = {}) {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  post<T>(url: string, data?: unknown, config: AxiosRequestConfig = {}) {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async shutdown() {
    this.breaker.shutdown();
  }

  private backoffDelayMs(attempt: number, error: unknown) {
    const { baseDelayMs, maxDelayMs } = this.retry;
    const retryAfter = isAxiosError(error) ? Number(error.response?.headers?.['retry-after']) : NaN;
    if (Number.isFinite(retryAfter) && retryAfter > 0)
      return Math.min(maxDelayMs, retryAfter * 1000);
    return Math.random() * Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)); // full jitter
  }

  private emitState(state: 'open' | 'half-open' | 'closed') {
    appEvents.emit('circuit.state.changed', { name: this.options.name, state });
  }

  private report(
    config: AxiosRequestConfig,
    attempt: number,
    startedAt: number,
    outcome: HttpRequestEvent['outcome'],
    status?: number,
  ) {
    appEvents.emit('http.request.completed', {
      client: this.options.name,
      method: (config.method ?? 'GET').toUpperCase(),
      path: config.url ?? '',
      status,
      attempt,
      outcome,
      durationMs: Math.round(performance.now() - startedAt),
    });
  }
}
