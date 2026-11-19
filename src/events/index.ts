import { EventEmitter } from 'node:events';

export interface HttpRequestEvent {
  client: string;
  method: string;
  path: string;
  status?: number;
  durationMs: number;
  attempt: number;
  outcome:
    | 'success'
    | 'client_error'
    | 'server_error'
    | 'network_error'
    | 'timeout'
    | 'circuit_open';
}

export interface CircuitStateEvent {
  name: string;
  state: 'open' | 'half-open' | 'closed';
}

export interface JobEvent {
  queue: string;
  jobName: string;
  jobId?: string;
  attempt: number;
  durationMs?: number;
  error?: string;
}

export interface DocumentLifecycleEvent {
  documentId: string;
  userId: string;
  documentName: string;
  reason?: string;
}

export interface UsageRecordedEvent {
  userId: string;
  kind: 'EMBEDDING' | 'CHAT_COMPLETION';
  provider: string;
  model: string;
  totalTokens: number;
  costUsd: number;
}

export interface AppEventMap {
  'http.request.completed': [HttpRequestEvent];
  'circuit.state.changed': [CircuitStateEvent];
  'job.completed': [JobEvent];
  'job.failed': [JobEvent];
  'document.ready': [DocumentLifecycleEvent];
  'document.failed': [DocumentLifecycleEvent];
  'usage.recorded': [UsageRecordedEvent];
}

export class AppEvents extends EventEmitter<AppEventMap> {}

export const appEvents = new AppEvents();
