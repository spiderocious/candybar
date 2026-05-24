import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'silent']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // 32-byte key, base64-encoded. The only platform secret in env.
  PROVIDER_ENCRYPTION_KEY: z.string().min(1),

  DISPATCH_CONCURRENCY: z.coerce.number().int().positive().default(10),
  DISPATCH_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  DISPATCH_BACKOFF_MS: z.coerce.number().int().positive().default(2000),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(50),

  RATE_LIMIT_CAPACITY: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_REFILL_PER_SEC: z.coerce.number().positive().default(2),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env: Env = parsed.data;
