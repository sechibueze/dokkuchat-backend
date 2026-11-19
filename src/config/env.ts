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
