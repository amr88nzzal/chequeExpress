/**
 * Deliverable 7 — the RLS *proof*: with the APPLICATION role, a query that has no
 * `WHERE tenant_id` at all still returns only the current tenant's rows, because
 * the policy — not application code — restricts the result.
 *
 * The counterpart (that the suite fails when FORCE or the policy is removed)
 * requires DDL and is therefore documented as a manual, reproducible procedure in
 * apps/api/README.md ("Proving the test can fail"). The detection logic itself is
 * proven with synthetic fixtures in `test/catalog-rules.test.ts`.
 *
 * Skipped, with a loud reason, when DATABASE_URL is unset.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely, type Transaction } from 'kysely';
import type pg from 'pg';
import {
  assertMigrationsApplied,
  createAdminPool,
  createAppDb,
  hasDatabase,
  migrateAndSeed,
  readCurrentRole,
  SKIP_REASON,
} from './support/db.ts';
import { TENANT_A, TENANT_B } from '../src/db/seed.ts';
import type { Database } from '../src/db/types.ts';
import { sqlSetLocalTenant } from '../src/db/tenant-transaction.ts';

if (SKIP_REASON !== null) {
  console.warn(`[rls-proof] SKIPPED: ${SKIP_REASON}`);
}

/**
 * Raw SQL goes through a Kysely instance with `CamelCasePlugin`, which maps the
 * result columns back to camelCase. The SQL says `tenant_id`; the yielded row
 * carries `tenantId`.
 */
interface ItemRowView {
  id: string;
  tenantId: string;
}

interface SettingRow {
  tenant: string | null;
}

describe.skipIf(!hasDatabase)('RLS proof: the policy filters, not the query', () => {
  let adminPool: pg.Pool;
  let appDb: Kysely<Database>;
  let appPool: pg.Pool;

  beforeAll(async () => {
    adminPool = createAdminPool();
    await migrateAndSeed(adminPool);
    await assertMigrationsApplied(adminPool);
    const appHandle = createAppDb();
    appDb = appHandle.db;
    appPool = appHandle.pool;
  }, 60_000);

  afterAll(async () => {
    await appDb.destroy();
    await appPool.end().catch(() => undefined);
    await adminPool.end().catch(() => undefined);
  });

  it('the app role is exactly what the rule requires: no superuser, no BYPASSRLS', async () => {
    const role = await readCurrentRole(appPool);
    expect(role.rolsuper).toBe(false);
    expect(role.rolbypassrls).toBe(false);
  });

  it('`select id, tenant_id from demo_items` (no WHERE) is tenant scoped by the policy alone', async () => {
    const rowsA = await inTenant(appDb, TENANT_A.tenantId, (tx) =>
      sql<ItemRowView>`select id, tenant_id from demo_items`.execute(tx),
    );
    const rowsB = await inTenant(appDb, TENANT_B.tenantId, (tx) =>
      sql<ItemRowView>`select id, tenant_id from demo_items`.execute(tx),
    );

    expect(rowsA.rows.length).toBeGreaterThan(0);
    expect(rowsB.rows.length).toBeGreaterThan(0);
    // `CamelCasePlugin` maps the raw result columns back to camelCase, so this
    // reads `tenantId`. An earlier revision read `row.tenant_id` and every access
    // was `undefined` (`Cannot read properties of undefined`).
    expect(rowsA.rows.every((row) => row.tenantId.toLowerCase() === TENANT_A.tenantId)).toBe(true);
    expect(rowsB.rows.every((row) => row.tenantId.toLowerCase() === TENANT_B.tenantId)).toBe(true);
  });

  it('a cross-tenant id is invisible even when it is supplied explicitly', async () => {
    const result = await inTenant(appDb, TENANT_A.tenantId, (tx) =>
      sql<ItemRowView>`select id from demo_items where id = ${TENANT_B.itemId}::uuid`.execute(tx),
    );
    expect(result.rows).toEqual([]);
  });

  it('the tenant claim is transaction LOCAL: it does not survive the commit', async () => {
    await inTenant(appDb, TENANT_A.tenantId, async (tx) => {
      const inside = await sql<SettingRow>`
        select current_setting('app.tenant_id', true) as tenant
      `.execute(tx);
      expect(inside.rows[0]?.tenant).toBe(TENANT_A.tenantId);
    });

    // Outside any transaction (a fresh pooled session) the setting is gone, which
    // is precisely why plain `SET` must never be used (docs/CONVENTIONS.md 8).
    const outside = await sql<SettingRow>`
      select current_setting('app.tenant_id', true) as tenant
    `.execute(appDb);
    const value = outside.rows[0]?.tenant;
    expect(value === null || value === '').toBe(true);
  });

  it('a statement that forgets the claim sees nothing (fail closed)', async () => {
    const result = await appDb.transaction().execute(async (tx) => {
      return sql<{ count: string }>`select count(*)::text as count from demo_items`.execute(tx);
    });
    expect(Number(result.rows[0]?.count ?? '-1')).toBe(0);
  });
});

async function inTenant<TResult>(
  db: Kysely<Database>,
  tenantId: string,
  fn: (tx: Transaction<Database>) => Promise<TResult>,
): Promise<TResult> {
  return db.transaction().execute(async (tx) => {
    await sqlSetLocalTenant(tx, tenantId);
    return fn(tx);
  });
}
