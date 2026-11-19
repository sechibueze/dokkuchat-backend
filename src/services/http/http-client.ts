import axios, { type AxiosAdapter, type AxiosInstance } from 'axios';

export interface HttpClientOptions {
  name: string;
  baseURL?: string;
  timeoutMs: number;
  headers?: Record<string, string>;
  /** Test seam. */
  adapter?: AxiosAdapter;
}

export function createHttpClient(options: HttpClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL,
    timeout: options.timeoutMs,
    headers: options.headers,
    adapter: options.adapter,
  });

  return instance;
}
