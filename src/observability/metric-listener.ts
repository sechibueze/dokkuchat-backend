import { appEvents } from '@/events';
import { metrics } from './metrics';

const CIRCUIT_VALUE = { closed: 0, 'half-open': 1, open: 2 } as const;

export function registerMetricListeners() {
  appEvents.on('http.request.completed', (e) => {
    metrics.httpClientRequests.inc({ client: e.client, method: e.method, outcome: e.outcome });
    metrics.httpClientDuration.observe(
      { client: e.client, outcome: e.outcome },
      e.durationMs / 1000,
    );
  });
  appEvents.on('circuit.state.changed', ({ name, state }) => {
    metrics.circuitState.set({ name }, CIRCUIT_VALUE[state]);
    metrics.circuitTransitions.inc({ name, state });
  });
  appEvents.on('job.completed', (e) => {
    metrics.jobs.inc({ queue: e.queue, job: e.jobName, status: 'completed' });
    if (e.durationMs !== undefined)
      metrics.jobDuration.observe({ queue: e.queue, job: e.jobName }, e.durationMs / 1000);
  });
  appEvents.on('job.failed', (e) =>
    metrics.jobs.inc({ queue: e.queue, job: e.jobName, status: 'failed' }),
  );
  appEvents.on('auth.event', ({ event }) => metrics.authEvents.inc({ event }));
  appEvents.on('rate_limit.rejected', ({ policy }) => metrics.rateLimitRejections.inc({ policy }));
  appEvents.on('cache.access', ({ result }) => metrics.cacheAccesses.inc({ result }));
  appEvents.on('db.query', ({ durationMs }) => metrics.dbQueryDuration.observe(durationMs / 1000));
  appEvents.on('document.ready', () => metrics.documentsProcessed.inc({ outcome: 'ready' }));
  appEvents.on('document.failed', () => metrics.documentsProcessed.inc({ outcome: 'failed' }));
  appEvents.on('usage.recorded', (e) => {
    const labels = { kind: e.kind, provider: e.provider, model: e.model };
    metrics.llmTokens.inc(labels, e.totalTokens);
    metrics.llmCost.inc(labels, e.costUsd);
  });
  appEvents.on('retrieval.completed', ({ answered, sources }) => {
    metrics.retrievals.inc({ outcome: answered ? 'answered' : 'no_context' });
    metrics.retrievalSources.observe(sources);
  });
  appEvents.on('tool.approval.changed', ({ status }) => metrics.toolApprovals.inc({ status }));
  appEvents.on('tool.call.completed', (e) => {
    metrics.toolCalls.inc({ server: e.server, outcome: e.outcome });
    metrics.toolCallDuration.observe({ server: e.server }, e.durationMs / 1000);
  });
}
