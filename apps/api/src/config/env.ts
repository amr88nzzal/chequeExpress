/**
 * Process configuration. Read once, validated with Zod, never scattered through
 * the code as `process.env.X` (docs/CONVENTIONS.md 14: configuration comes from
 * environment variables, and no secrets in the repository).
 *
 * `loadConfig` throws on a bad or missing value instead of silently defaulting:
 * a missing DATABASE_URL must fail loudly at startup, not halfway through a
 * request.
 */
import { z } from 'zod';

const configSchema = z.object({
  /** Application role connection (NOT owner, NOT superuser, NOT BYPASSRLS). */
  databaseUrl: z.string().min(1),
  /** Migration/owner role connection. Only the migration and seed CLIs use it. */
  databaseAdminUrl: z.string().min(1).optional(),
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse({
    databaseUrl: env['DATABASE_URL'],
    databaseAdminUrl: env['DATABASE_ADMIN_URL'],
    port: env['PORT'],
    logLevel: env['LOG_LEVEL'],
    nodeEnv: env['NODE_ENV'],
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }

  return parsed.data;
}

/** The migration/owner connection string, with an explicit failure when absent. */
export function requireAdminDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env['DATABASE_ADMIN_URL'] ?? env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_ADMIN_URL (or DATABASE_URL) must be set to run migrations. ' +
        'See apps/api/README.md.',
    );
  }
  return url;
}
