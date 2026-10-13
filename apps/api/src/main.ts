/**
 * Process entry point: `npm run dev` (tsx watch) or `node src/main.ts`
 * (Node 22 type stripping).
 *
 * Startup order matters: configuration is validated first, so a missing
 * DATABASE_URL fails immediately with a clear message instead of halfway through
 * the first request.
 */
import { loadConfig } from './config/env.ts';
import { writeError } from './config/cli-output.ts';
import { closeDb, getDb, requireDatabaseUrl } from './db/pool.ts';
import { createApp } from './app.ts';
import { systemClock } from './http/clock.ts';
import { createLogger } from './http/logger.ts';
import { DevHeaderIdentityResolver } from './http/tenant.ts';

async function main(): Promise<void> {
  const config = loadConfig();
  requireDatabaseUrl();

  const logger = createLogger({ level: config.logLevel, base: { env: config.nodeEnv } });
  const { express } = createApp({
    db: getDb(),
    clock: systemClock(),
    logger,
    // C1 replaces this with the real identity provider. It refuses to resolve
    // anything when NODE_ENV=production, so it cannot become a bypass.
    resolver: new DevHeaderIdentityResolver(),
  });

  const server = express.listen(config.port, () => {
    logger.info({ port: config.port }, 'cheques-api listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void closeDb().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  // Configuration failures must be readable before any logger exists.
  writeError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
