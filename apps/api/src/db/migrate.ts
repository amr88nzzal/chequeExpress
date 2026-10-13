/**
 * Tiny sequential SQL migration runner. No migration library, by project decision
 * (docs/CONVENTIONS.md 18: small sequential SQL migrations that run both on an
 * empty database and on a copy that already has data).
 *
 * Design notes:
 *  - one file = one migration, applied in filename order, in its own transaction;
 *  - the SHA-256 of each file is recorded, so editing an already-applied migration
 *    fails loudly instead of silently diverging between environments;
 *  - migrations never run as the application role: this runner is only ever given
 *    the owner/admin connection (`DATABASE_ADMIN_URL`);
 *  - `pg` is used directly here, not Kysely, because a migration file contains
 *    several statements (DO blocks, functions) and must be sent over the simple
 *    query protocol as one string; Kysely's extended protocol allows one statement
 *    per call.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';

export interface MigrationFile {
  version: string;
  path: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  version: string;
  checksum: string;
}

export interface RunMigrationsResult {
  applied: string[];
  skipped: string[];
}

export interface RunMigrationsOptions {
  directory?: string;
  migrations?: readonly MigrationFile[];
  /** Progress sink. Defaults to silent; the CLI passes `console.log`. */
  onProgress?: (message: string) => void;
}

const DEFAULT_MIGRATIONS_DIR = join(import.meta.dirname, 'migrations');

export async function loadMigrationFiles(
  directory: string = DEFAULT_MIGRATIONS_DIR,
): Promise<MigrationFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    files.map(async (name) => {
      const path = join(directory, name);
      const sql = await readFile(path, 'utf8');
      return {
        version: name.replace(/\.sql$/, ''),
        path,
        sql,
        checksum: sha256(sql),
      };
    }),
  );
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function runMigrations(
  pool: Pool,
  options: RunMigrationsOptions = {},
): Promise<RunMigrationsResult> {
  const log = options.onProgress ?? (() => undefined);
  const files = options.migrations ?? (await loadMigrationFiles(options.directory));

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    text        PRIMARY KEY,
        checksum   text        NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = await readAppliedMigrations(client);
    const result: RunMigrationsResult = { applied: [], skipped: [] };

    for (const file of files) {
      const previous = applied.get(file.version);

      if (previous !== undefined) {
        if (previous !== file.checksum) {
          throw new Error(
            `Migration ${file.version} was already applied but its contents changed ` +
              `(recorded ${previous}, found ${file.checksum}). Migrations are immutable: ` +
              'add a new file instead of editing an applied one.',
          );
        }
        result.skipped.push(file.version);
        log(`= ${file.version} (already applied)`);
        continue;
      }

      await applyOne(client, file);
      result.applied.push(file.version);
      log(`+ ${file.version}`);
    }

    return result;
  } finally {
    client.release();
  }
}

async function applyOne(client: PoolClient, file: MigrationFile): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(file.sql);
    await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
      file.version,
      file.checksum,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Migration ${file.version} failed: ${describeError(error)}`, { cause: error });
  }
}

async function readAppliedMigrations(client: PoolClient): Promise<Map<string, string>> {
  const { rows } = await client.query<AppliedMigration>(
    'SELECT version, checksum FROM schema_migrations',
  );
  return new Map(rows.map((row) => [row.version, row.checksum]));
}

function describeError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
