import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from '@prometheus-io/client';
import { QueueName } from '@/services/queue/job.payload';
import { getQueue } from '@/services/queue';

export const registry = new Registry();
registry.setDefaultLabels({ service: 'dokkuchat-api' });
collectDefaultMetrics({ register: registry });

const fast = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const slow = [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120];
const registers = [registry];
const counter = (name: string, help: string, labelNames: string[] = []) =>
  new Counter({ name, help, labelNames, registers });
const histogram = (name: string, help: string, buckets: number[], labelNames: string[] = []) =>
  new Histogram({ name, help, buckets, labelNames, registers });
const gauge = (name: string, help: string, labelNames: string[] = []) =>
  new Gauge({ name, help, labelNames, registers });

export const metrics = {
  httpServerRequests: counter('http_server_requests_total', 'Inbound requests', [
    'method',
    'route',
    'status',
  ]),
  httpServerDuration: histogram(
    'http_server_request_duration_seconds',
    'Inbound request latency',
    fast,
    ['method', 'route', 'status'],
  ),
  httpClientRequests: counter('http_client_requests_total', 'Outbound requests', [
    'client',
    'method',
    'outcome',
  ]),
  httpClientDuration: histogram('http_client_request_duration_seconds', 'Outbound latency', slow, [
    'client',
    'outcome',
  ]),
  circuitState: gauge('circuit_breaker_state', '0 closed, 1 half-open, 2 open', ['name']),
  circuitTransitions: counter('circuit_breaker_transitions_total', 'Breaker transitions', [
    'name',
    'state',
  ]),
  jobs: counter('queue_jobs_total', 'Finished jobs', ['queue', 'job', 'status']),
  jobDuration: histogram('queue_job_duration_seconds', 'Job duration', slow, ['queue', 'job']),
  authEvents: counter('auth_events_total', 'Authentication events', ['event']),
  rateLimitRejections: counter('rate_limit_rejections_total', 'Rate-limited requests', ['policy']),
  cacheAccesses: counter('cache_accesses_total', 'Cache reads', ['result']),
  dbQueryDuration: histogram('db_query_duration_seconds', 'Database query duration', fast),
  dependencyUp: gauge('dependency_up', '1 when the last readiness check passed', ['dependency']),
  dependencyLatency: gauge('dependency_check_latency_seconds', 'Last readiness check latency', [
    'dependency',
  ]),
  llmTokens: counter('llm_tokens_total', 'Tokens consumed', ['kind', 'provider', 'model']),
  llmCost: counter('llm_cost_usd_total', 'Estimated cost in USD', ['kind', 'provider', 'model']),
  documentsProcessed: counter('documents_processed_total', 'Documents finished', ['outcome']),
  retrievals: counter('rag_retrievals_total', 'Retrievals', ['outcome']),
  retrievalSources: histogram(
    'rag_retrieval_sources',
    'Sources used per answer',
    [0, 1, 2, 3, 4, 5],
  ),
  toolApprovals: counter('tool_approvals_total', 'Tool approvals by status', ['status']),
  toolCalls: counter('mcp_tool_calls_total', 'MCP tool calls', ['server', 'outcome']),
  toolCallDuration: histogram('mcp_tool_call_duration_seconds', 'MCP tool latency', slow, [
    'server',
  ]),
};

// Queue depth is read at scrape time, so it is always current and costs nothing between scrapes.
new Gauge({
  name: 'queue_jobs',
  help: 'Jobs by queue and state',
  labelNames: ['queue', 'state'],
  registers,
  async collect() {
    try {
      for (const queue of Object.values(QueueName)) {
        const counts = await getQueue(queue).getJobCounts('waiting', 'active', 'delayed', 'failed');
        for (const [state, count] of Object.entries(counts)) this.set({ queue, state }, count);
      }
    } catch {
      /* Redis down: the dependency_up gauge already shows it */
    }
  },
});
