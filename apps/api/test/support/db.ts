/**
 * Integration-test database plumbing.
 *
 * EVERYTHING database-backed is gated on `DATABASE_URL`. On a machine without
 * PostgreSQL (the Windows development box for this project has no server and no
 * Docker) the suites are reported as SKIPPED with the reason below, never faked,
 * never silently passed. In CI the same suites run for real against the
 * `postgres:17` service configured in `.github/workflows/ci.yml`.
 *
 * Two roles are used, on purpose:
 *   DATABASE_URL        the application role (cheques_app): not owner, not
 *                       superuser, not BYPASSRLS. Every assertion about what the
 *                       API can see runs as this role, otherwise the test would
 *                       prove nothing.
 *   DATABASE_ADMIN_URL  the migration/owner role: creates the schema and the
 *                       two-tenant fixtures. Falls back to DATABASE_URL, which
 *                       works only if that role may run DDL.
 */
import type pg from 'pg';
import { createDb, createPool, type PoolOptions } from '../../src/db/pool.ts';
import { loadMigrationFiles, runMigrations } from '../../src/db/migrate.ts';
import { seedDemoData, type DemoTenant } from '../../src/db/seed.ts';
import type { Db } from '../../src/db/tenant-transaction.ts';

/** Why the database suites are skipped, or `null` when they can run. */
export const SKIP_REASON: string | null =
  process.env['DATABASE_URL'] === undefined || process.env['DATABASE_URL'] === ''
    ? 'DATABASE_URL is not set: no PostgreSQL is reachable from this machine, so the ' +
      'database-backed acceptance tests cannot run. They run in CI (GitHub Actions, ' +
      'postgres:17 service) and locally after setting DATABASE_URL. See apps/api/README.md.'
    : null;

/** `true` when a database is configured; use it to guard `describe.skipIf`. */
export const hasDatabase = SKIP_REASON === null;

export function adminConnectionString(): string {
  const admin = process.env['DATABASE_ADMIN_URL'];
  if (admin !== undefined && admin !== '') return admin;
  const fallback = process.env['DATABASE_URL'];
  if (fallback === undefined || fallback === '') {
    throw new Error('Neither DATABASE_ADMIN_URL nor DATABASE_URL is set');
  }
  return fallback;
}

export function appConnectionString(): string {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
}

export function createAdminPool(overrides: PoolOptions = {}): pg.Pool {
  return createPool(adminConnectionString(), {
    max: 2,
    applicationName: 'cheques-api-test-admin',
    ...overrides,
  });
}

export function createAppPool(overrides: PoolOptions = {}): pg.Pool {
  return createPool(appConnectionString(), {
    max: 4,
    applicationName: 'cheques-api-test-app',
    ...overrides,
  });
}

/** Kysely as the application role, for the low-level RLS proofs. */
export function createAppDb(overrides: PoolOptions = {}): { db: Db; pool: pg.Pool } {
  const pool = createAppPool(overrides);
  return { db: createDb(pool), pool };
}

/**
 * Runs every migration file, then the two-tenant fixtures. Idempotent: migrations
 * already applied are skipped by checksum, and the seed upserts by id.
 */
export async function migrateAndSeed(
  adminPool: pg.Pool,
): Promise<{ tenants: readonly DemoTenant[]; applied: string[]; skipped: string[] }> {
  const files = await loadMigrationFiles();
  const result = await runMigrations(adminPool, { migrations: files });
  const tenants = await seedDemoData(adminPool);
  return { tenants, applied: result.applied, skipped: result.skipped };
}

/**
 * Asserts that the database this suite connected to has every migration on disk.
 * A stale local database then fails with an explicit message instead of a
 * confusing "relation does not exist" halfway through an assertion.
 */
export async function assertMigrationsApplied(pool: pg.Pool): Promise<void> {
  const files = await loadMigrationFiles();
  const { rows } = await pool.query<{ version: string }>('select version from schema_migrations');
  const applied = new Set(rows.map((row) => row.version));
  const missing = files.map((file) => file.version).filter((version) => !applied.has(version));

  if (missing.length > 0) {
    throw new Error(
      `Migrations not applied: ${missing.join(', ')}. Run 'npm run migrate --workspace @cheques/api' ` +
        'against this database as the migration role.',
    );
  }
}

/** The application role's identity attributes, read from the catalog. */
export interface RoleAttributes {
  rolname: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
}

export async function readCurrentRole(pool: pg.Pool): Promise<RoleAttributes> {
  const { rows } = await pool.query<RoleAttributes>(
    `select rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
       from pg_roles
      where rolname = current_user`,
  );
  const role = rows[0];
  if (role === undefined) {
    throw new Error('current_user is not present in pg_roles');
  }
  return role;
}
