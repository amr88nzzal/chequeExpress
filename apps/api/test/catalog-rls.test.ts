/**
 * The catalog super-test (docs/CONVENTIONS.md 8):
 *
 *   "اختبار فوقي يفشل في CI: يستعلم عن pg_catalog ويتأكد أن كل جدول خارج القائمة
 *    العامة فيه tenant_id وRLS مفعّل وسياسة موجودة."
 *
 * Every table in schema `public`, except the explicit global allow-list, must have
 * a NOT NULL `tenant_id`, RLS ENABLED, RLS FORCED and at least one policy. A table
 * added later without protection FAILS this test.
 *
 * It connects as the APPLICATION role (cheques_app), not as the owner: that is the
 * role whose view must be protected, and reading its own catalog is the honest
 * check. If the catalog turned out to be unreadable the test fails loudly instead
 * of skipping — a security test that silently skips is worse than no test.
 *
 * Skipped, with a loud reason, when DATABASE_URL is unset. The detection logic
 * itself, including fixtures for unprotected tables, is proven without a database
 * in `test/catalog-rules.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import {
  ALLOWED_GLOBAL_TABLES,
  describeViolations,
  findCatalogViolations,
  type CatalogSnapshot,
} from './support/catalog-rules.ts';
import { readCatalogSnapshot } from './support/catalog-reader.ts';
import {
  createAdminPool,
  createAppPool,
  hasDatabase,
  migrateAndSeed,
  SKIP_REASON,
} from './support/db.ts';

if (SKIP_REASON !== null) {
  console.warn(`[catalog-rls] SKIPPED: ${SKIP_REASON}`);
}

describe.skipIf(!hasDatabase)('catalog super-test: every public table is tenant protected', () => {
  let adminPool: pg.Pool;
  let appPool: pg.Pool;
  let catalogError: string | null = null;
  let snapshot: CatalogSnapshot | null = null;

  beforeAll(async () => {
    adminPool = createAdminPool();
    await migrateAndSeed(adminPool);

    appPool = createAppPool();
    try {
      snapshot = await readCatalogSnapshot(appPool);
    } catch (error) {
      catalogError = error instanceof Error ? error.message : String(error);
    }
  }, 60_000);

  afterAll(async () => {
    await appPool?.end().catch(() => undefined);
    await adminPool?.end().catch(() => undefined);
  });

  it('gets a readable catalog as the application role', () => {
    if (catalogError !== null) {
      throw new Error(
        `The pg_catalog checks cannot run as the application role: ${catalogError}. ` +
          'Grant the application role catalog access, or re-run the migrations ' +
          '(0001_roles.sql). This test must not skip silently: see apps/api/README.md.',
      );
    }
    expect(snapshot).not.toBeNull();
  });

  it('sanity: the snapshot sees the tables this slice created', () => {
    expect(snapshot?.tables).toEqual(
      expect.arrayContaining(['demo_attachments', 'demo_items', 'schema_migrations']),
    );
  });

  it('EVERY public table outside the allow-list has tenant_id + enabled + forced + policy', () => {
    const violations = findCatalogViolations(snapshot ?? emptySnapshot());

    // One readable line per violation, so a CI failure names the table and the guard.
    expect(describeViolations(violations)).toBe('');
    expect(violations).toEqual([]);
  });

  it('the allow-list holds only documented global tables', () => {
    // Guards against the allow-list being extended silently: every entry must be a
    // global/infrastructure table named in DESIGN.md, never a tenant table.
    const globalTables = ['schema_migrations', 'countries', 'currencies', 'banks'];
    for (const table of globalTables) {
      expect(ALLOWED_GLOBAL_TABLES.has(table)).toBe(true);
    }
    // And nothing that this slice created as tenant data may be on it.
    for (const table of ['demo_items', 'demo_attachments']) {
      expect(ALLOWED_GLOBAL_TABLES.has(table)).toBe(false);
    }
  });

  it('the demo tables carry the tenant policy with the expected predicate', async () => {
    const { rows } = await appPool.query<{
      tablename: string;
      qual: string | null;
      withcheck: string | null;
    }>(
      // `pg_policies` already exposes the policy expressions as `qual` and
      // `withcheck`. An earlier revision called
      // `pg_get_expr(polqual, polrelid)` / `pg_get_expr(polwithcheck, polrelid)`,
      // which are columns of the pg_policy CATALOG TABLE and not of this view, so
      // PostgreSQL 17 rejected the statement with
      // `column "polqual" does not exist` and the query returned nothing.
      `select tablename,
              qual,
              with_check as withcheck
         from pg_policies
        where schemaname = 'public'
          and tablename in ('demo_items', 'demo_attachments')
        order by tablename`,
    );

    expect(rows.map((row) => row.tablename)).toEqual(['demo_attachments', 'demo_items']);
    for (const row of rows) {
      expect(row.qual).toContain('app_current_tenant()');
      expect(row.withcheck).toContain('app_current_tenant()');
    }
  });

  it('tenant_id is a NOT NULL uuid everywhere it exists', async () => {
    const { rows } = await appPool.query<{
      table_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `select table_name, data_type, is_nullable
         from information_schema.columns
        where table_schema = 'public'
          and column_name = 'tenant_id'
        order by table_name`,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(`${row.table_name}:${row.data_type}:${row.is_nullable}`).toBe(
        `${row.table_name}:uuid:NO`,
      );
    }
  });
});

function emptySnapshot(): CatalogSnapshot {
  return {
    tables: [],
    tablesWithTenantId: [],
    tablesWithRlsEnabled: [],
    tablesWithRlsForced: [],
    tablesWithPolicy: [],
    tenantIdNotNull: [],
  };
}
