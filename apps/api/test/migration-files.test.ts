/**
 * Static checks on the SQL migrations that need no database.
 *
 * These are the rules that are cheap to state and expensive to forget: sequential
 * filenames, and the tenant quartet (tenant_id, ENABLE, FORCE, policy) in every
 * file that creates a table. They complement — they do not replace — the catalog
 * super-test, which asks PostgreSQL itself.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadMigrationFiles, sha256 } from '../src/db/migrate.ts';

const MIGRATIONS_DIR_URL = new URL('../src/db/migrations/', import.meta.url);
const MIGRATIONS_DIR = fileURLToPath(MIGRATIONS_DIR_URL);

/**
 * Removes `-- line` and block comments. Needed because the migrations *say* the
 * word "float" in a comment explaining that floats are forbidden.
 */
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

describe('migration files', () => {
  it('loads every .sql file in sequential order', async () => {
    const files = await loadMigrationFiles(MIGRATIONS_DIR);

    expect(files.length).toBeGreaterThanOrEqual(5);
    expect(files.map((file) => file.version)).toEqual([
      '0001_roles',
      '0002_schema_migrations',
      '0003_demo_items',
      '0004_uuid_v7',
      '0005_demo_attachments',
    ]);
    // Lexicographic order is the execution order; a zero-padded prefix is what
    // makes that true past 9 files.
    const versions = files.map((file) => file.version);
    expect(versions).toEqual([...versions].sort((left, right) => left.localeCompare(right)));
  });

  it('records a stable SHA-256 checksum per file', async () => {
    const files = await loadMigrationFiles(MIGRATIONS_DIR);
    for (const file of files) {
      expect(file.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(file.checksum).toBe(sha256(file.sql));
    }
  });

  it('names every file NNNN_name.sql', async () => {
    const files = await loadMigrationFiles(MIGRATIONS_DIR);
    for (const file of files) {
      expect(file.version).toMatch(/^\d{4}_[a-z0-9_]+$/);
    }
  });

  it('never uses a floating point type for money', async () => {
    const files = await loadMigrationFiles(MIGRATIONS_DIR);
    for (const file of files) {
      // Comments are stripped first: a migration is allowed to say "never a float".
      const sql = stripSqlComments(file.sql).toLowerCase();
      expect(sql).not.toMatch(/\b(float|real|double\s+precision)\b/);
      // `numeric` must always carry its precision and scale.
      expect(sql).not.toMatch(/\bnumeric\s*[,(]?\s*\)/);
    }
  });

  it('applies the tenant quartet to every table it creates', async () => {
    const files = await loadMigrationFiles(MIGRATIONS_DIR);
    const allowListed = ['schema_migrations'];

    for (const file of files) {
      const sql = file.sql;
      const created = [...sql.matchAll(/create table if not exists\s+([a-z_]+)/gi)].map(
        (match) => match[1] as string,
      );

      for (const table of created) {
        if (allowListed.includes(table)) continue;

        expect(sql, `${file.version}: ${table} needs tenant_id`).toMatch(
          new RegExp(
            `create table if not exists\\s+${table}\\s*\\([\\s\\S]*?tenant_id\\s+uuid\\s+not null`,
            'i',
          ),
        );
        expect(sql, `${file.version}: ${table} needs ENABLE ROW LEVEL SECURITY`).toContain(
          `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
        );
        expect(sql, `${file.version}: ${table} needs FORCE ROW LEVEL SECURITY`).toContain(
          `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`,
        );
        expect(sql, `${file.version}: ${table} needs a CREATE POLICY`).toMatch(
          new RegExp(`create policy\\s+\\S+\\s+on\\s+${table}\\b`, 'i'),
        );
      }
    }
  });

  it('grants the application role exactly the DML it needs', async () => {
    const files = await loadMigrationFiles(MIGRATIONS_DIR);
    const all = files.map((file) => file.sql).join('\n');

    expect(all).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE demo_items TO cheques_app;',
    );
    expect(all).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE demo_attachments TO cheques_app;',
    );
    // The application role must never be able to change the schema.
    // The check is per statement, not across the whole file: `CREATE` appears
    // legitimately in other statements (CREATE POLICY, CREATE OR REPLACE
    // FUNCTION), so a whole-file regex produced false positives.
    expect(all).not.toMatch(/grant\s+all/i);
    const statements = all
      .split(';')
      .map((statement) =>
        statement
          .replace(/--[^\n]*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter((statement) => /^grant\b/i.test(statement) && /\bcheques_app\b/i.test(statement));
    for (const statement of statements) {
      // `GRANT USAGE ON SCHEMA public` is required and harmless; every other
      // grant to the application role must be pure DML.
      if (/^grant\s+usage\s+on\s+schema\b/i.test(statement)) continue;
      expect(statement).not.toMatch(/^grant\s+(all|create)\b/i);
      expect(statement).not.toMatch(/\b(create|alter|drop|truncate|references|trigger)\b/i);
    }
  });

  it('creates the application role with NOSUPERUSER NOBYPASSRLS', async () => {
    const files = await loadMigrationFiles(MIGRATIONS_DIR);
    const roles = files.find((file) => file.version === '0001_roles')?.sql ?? '';

    expect(roles).toMatch(
      /ALTER ROLE cheques_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;/,
    );
    expect(roles).toContain('CREATE ROLE cheques_owner');
  });

  it('the loader returns readable files', async () => {
    const files = await loadMigrationFiles(MIGRATIONS_DIR);
    for (const file of files) {
      const content = await readFile(file.path, 'utf8');
      expect(content.length).toBeGreaterThan(0);
      expect(content).toBe(file.sql);
    }
  });
});
