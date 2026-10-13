/**
 * `npm run migrate` entry point.
 *
 * Runs as the migration/owner role, never as the application role:
 *
 *   DATABASE_ADMIN_URL=postgres://cheques_owner:...@host:5432/cheques_test npm run migrate
 *
 * `DATABASE_ADMIN_URL` falls back to `DATABASE_URL` for the small-database case
 * where an operator uses one superuser connection for both.
 */
import pg from 'pg';
import { loadConfig, requireAdminDatabaseUrl } from '../config/env.ts';
import { writeError, writeOut } from '../config/cli-output.ts';
import { loadMigrationFiles, runMigrations } from './migrate.ts';

const { Pool } = pg;

async function main(): Promise<void> {
  const config = loadConfig();
  const connectionString = requireAdminDatabaseUrl();
  const files = await loadMigrationFiles();

  writeOut(`Running ${files.length} migration file(s) as the migration role.`);

  const pool = new Pool({ connectionString, application_name: 'cheques-api-migrate', max: 1 });
  try {
    const result = await runMigrations(pool, { migrations: files, onProgress: writeOut });
    writeOut(
      `Done. applied=${result.applied.length} skipped=${result.skipped.length} ` +
        `(env=${config.nodeEnv})`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  writeError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
