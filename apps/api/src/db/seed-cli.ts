/**
 * Seed CLI: `npm run seed`.
 *
 * Kept separate from `seed.ts` (which holds the fixtures and is imported by the
 * tests) so that importing the fixtures never starts a connection pool.
 */
import pg from 'pg';
import { loadConfig, requireAdminDatabaseUrl } from '../config/env.ts';
import { writeError, writeOut } from '../config/cli-output.ts';
import { seedDemoData } from './seed.ts';

const { Pool } = pg;

async function main(): Promise<void> {
  const config = loadConfig();
  const connectionString = requireAdminDatabaseUrl();
  const pool = new Pool({ connectionString, application_name: 'cheques-api-seed', max: 1 });
  try {
    const tenants = await seedDemoData(pool);
    for (const tenant of tenants) {
      writeOut(`seeded tenant ${tenant.tenantId} (item ${tenant.itemId})`);
    }
    writeOut(`Done. tenants=${tenants.length} (env=${config.nodeEnv})`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  writeError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
