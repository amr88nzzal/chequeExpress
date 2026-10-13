/**
 * Connection pool + Kysely instance.
 *
 * `CamelCasePlugin` performs the snake_case ↔ camelCase translation promised in
 * docs/CONVENTIONS.md 4: SQL stays snake_case, TypeScript stays camelCase, and no
 * mapping is written by hand.
 *
 * The process-wide handle (`getDb`) is built lazily on first property access, so
 * importing a module that imports this one does not open sockets and does not
 * demand `DATABASE_URL`: unit tests can build the HTTP app without a database.
 */
import { CamelCasePlugin, Kysely, PostgresDialect, type Dialect } from 'kysely';
import pg from 'pg';
import type { Database } from './types.ts';
import type { Db } from './tenant-transaction.ts';

const { Pool } = pg;

export interface PoolOptions {
  max?: number;
  applicationName?: string;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  /** Server-side statement timeout; a forgotten transaction cannot hold the tenant claim forever. */
  statementTimeoutMillis?: number;
}

export function createPool(connectionString: string, options: PoolOptions = {}): pg.Pool {
  if (connectionString === '') {
    throw new Error('A connection string is required to create a pool');
  }

  return new Pool({
    connectionString,
    max: options.max ?? 10,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
    application_name: options.applicationName ?? 'cheques-api',
    statement_timeout: options.statementTimeoutMillis,
  });
}

/** Kysely over an existing pool. */
export function createDb(pool: pg.Pool): Db {
  const dialect: Dialect = new PostgresDialect({ pool });
  return new Kysely<Database>({
    dialect,
    plugins: [new CamelCasePlugin()],
  });
}

/** Kysely over a connection string, for tests and CLIs. */
export function createDbFromUrl(connectionString: string, options: PoolOptions = {}): Db {
  return createDb(createPool(connectionString, options));
}

/** The connection string the API must use. Throws with a pointer to the README. */
export function requireDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set. Integration tests and the API need it; unit tests do not. ' +
        'See apps/api/README.md.',
    );
  }
  return url;
}

let cached: { db: Db; pool: pg.Pool } | undefined;

/** The process-wide database handle. Created on first property access. */
export function getDb(): Db {
  cached ??= createDefaultDb();
  return cached.db;
}

export function getPool(): pg.Pool {
  cached ??= createDefaultDb();
  return cached.pool;
}

function createDefaultDb(): { db: Db; pool: pg.Pool } {
  const pool = createPool(requireDatabaseUrl());
  return { db: createDb(pool), pool };
}

/** Closes the pooled connections. Call it on shutdown and in tests' `afterAll`. */
export async function closeDb(): Promise<void> {
  if (cached === undefined) return;
  const { db, pool } = cached;
  cached = undefined;
  await db.destroy();
  await pool.end().catch(() => undefined);
}
