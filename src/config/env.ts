import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(18000),
    DATABASE_URL: z.url(),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().default('dokkuchat'),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
    FRONTEND_URL: z.url().default('http://localhost:3000'),
    RUN_WORKERS: z.stringbool().default(true),
    REDIS_URL: z.url(),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    // Storage configuration
    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('.storage'),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_REGION: z.string().default('auto'),
    STORAGE_ENDPOINT: z.url().optional(),
    STORAGE_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().optional(),

    // LLM configuration
    EMBEDDING_PROVIDER: z
      .enum(['ollama', 'openai', 'voyage', 'cohere', 'gemini', 'jina'])
      .default('gemini'),

    // Observability
    ENABLE_METRICS: z.stringbool().default(true),
    METRICS_TOKEN: z.string().min(16).optional(),

    // Documentation
    ENABLE_API_DOCS: z.stringbool().optional(),

    // MCPS
    MCP_CLIENT_SERVERS: z.string().default('[]'),
    MCP_SERVER_ENABLED: z.stringbool().default(true),

    VOYAGE_API_KEY: z.string().optional(),
    VOYAGE_BASE_URL: z.string().url().default('https://api.voyageai.com/v1'),
    VOYAGE_EMBEDDING_MODEL: z.string().default('voyage-3.5'),

    COHERE_API_KEY: z.string().optional(),
    COHERE_BASE_URL: z.string().url().default('https://api.cohere.com/v2'),
    COHERE_EMBEDDING_MODEL: z.string().default('embed-v4.0'),

    GEMINI_API_KEY: z.string().optional(),
    GEMINI_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com/v1beta'),
    GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),

    JINA_API_KEY: z.string().optional(),
    JINA_BASE_URL: z.string().url().default('https://api.jina.ai/v1'),
    JINA_EMBEDDING_MODEL: z.string().default('jina-embeddings-v3'),

    // LLM Providers
    LLM_PROVIDER: z
      .enum(['ollama', 'openai', 'groq', 'openrouter', 'cloudflare', 'gemini'])
      .default('gemini'),

    OPENAI_API_KEY: z.string().optional(),
    OPENAI_BASE_URL: z.url().default('https://api.openai.com/v1'),
    OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
    OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),

    // Ollama configs
    OLLAMA_BASE_URL: z.url().default('http://localhost:11434'),
    OLLAMA_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
    OLLAMA_CHAT_MODEL: z.string().default('tinyllama:1.1b'),

    GROQ_API_KEY: z.string().optional(),
    GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
    GROQ_CHAT_MODEL: z.string().default('llama-3.3-70b-versatile'),

    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
    OPENROUTER_CHAT_MODEL: z.string().default('meta-llama/llama-3.3-70b-instruct:free'),
    OPENROUTER_SITE_URL: z.string().url().optional(),
    OPENROUTER_APP_NAME: z.string().optional(),

    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    CLOUDFLARE_API_TOKEN: z.string().optional(),
    CLOUDFLARE_CHAT_MODEL: z.string().default('@cf/meta/llama-3.3-70b-instruct-fp8-fast'),

    GEMINI_CHAT_MODEL: z.string().default('gemini-2.5-flash'),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_PROVIDER === 'local') return;
    for (const key of [
      'STORAGE_BUCKET',
      'STORAGE_ACCESS_KEY_ID',
      'STORAGE_SECRET_ACCESS_KEY',
    ] as const) {
      if (!value[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when STORAGE_PROVIDER=${value.STORAGE_PROVIDER}`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, unknown> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const env = parseEnv();
