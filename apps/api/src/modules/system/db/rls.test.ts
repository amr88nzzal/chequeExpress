import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, withTenant, type Database } from './index.ts';
import { startTestDatabase, type TestDatabase } from './test-database.ts';

let testDb: TestDatabase;
let db: Database;
const tenantA = randomUUID();
const tenantB = randomUUID();
let parentA = '';
let parentB = '';

const pgCode = async (p: Promise<unknown>): Promise<string | undefined> => {
  try {
    await p;
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  }
};

beforeAll(async () => {
  testDb = await startTestDatabase();
  db = createDb(testDb.appUrl);
  parentA = (
    await withTenant(db, { tenantId: tenantA }, (tx) =>
      tx
        .insertInto('rlsProbeParents')
        .values({ tenantId: tenantA, name: 'A-parent' })
        .returning('id')
        .executeTakeFirstOrThrow(),
    )
  ).id;
  parentB = (
    await withTenant(db, { tenantId: tenantB }, (tx) =>
      tx
        .insertInto('rlsProbeParents')
        .values({ tenantId: tenantB, name: 'B-parent' })
        .returning('id')
        .executeTakeFirstOrThrow(),
    )
  ).id;
  await withTenant(db, { tenantId: tenantA }, (tx) =>
    tx
      .insertInto('rlsProbeChildren')
      .values({ tenantId: tenantA, parentId: parentA, note: 'A-child' })
      .execute(),
  );
  await withTenant(db, { tenantId: tenantB }, (tx) =>
    tx
      .insertInto('rlsProbeChildren')
      .values({ tenantId: tenantB, parentId: parentB, note: 'B-child' })
      .execute(),
  );
});

afterAll(async () => {
  await db?.destroy();
  await testDb?.stop();
});

describe('uuidv7()', () => {
  it('returns version-7 UUIDs that are time-ordered', async () => {
    const before = Date.now();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await sql<{ id: string }>`select uuidv7()::text as id`.execute(db);
      ids.push(r.rows[0]!.id);
      await new Promise((res) => setTimeout(res, 3));
    }
    for (const id of ids) expect(id[14]).toBe('7');
    expect([...ids].sort()).toEqual(ids);
    const ms = parseInt(ids[0]!.replaceAll('-', '').slice(0, 12), 16);
    expect(Math.abs(ms - before)).toBeLessThan(5_000);
  });
});

describe('roles and catalog', () => {
  it('app role is not superuser, not BYPASSRLS, and owns no tables', async () => {
    const admin = new Client({ connectionString: testDb.adminUrl });
    await admin.connect();
    const role = await admin.query(
      'select rolsuper, rolbypassrls from pg_roles where rolname = $1',
      ['cheques_app'],
    );
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const owned = await admin.query(
      "select tablename from pg_tables where schemaname = 'public' and tableowner = 'cheques_app'",
    );
    expect(owned.rowCount).toBe(0);
    await admin.end();
  });

  it('every tenant table has tenant_id, RLS enabled and FORCED, and a policy (guard against forgetting)', async () => {
    const admin = new Client({ connectionString: testDb.adminUrl });
    await admin.connect();
    const PUBLIC_TABLES = ['schema_migrations']; // explicit allow-list of non-tenant tables
    const tables = await admin.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname <> all($1)`,
      [PUBLIC_TABLES],
    );
    expect(tables.rows.length).toBeGreaterThan(0);
    for (const t of tables.rows) {
      expect(t.relrowsecurity, `${t.relname}: RLS enabled`).toBe(true);
      expect(t.relforcerowsecurity, `${t.relname}: RLS forced`).toBe(true);
      const col = await admin.query(
        "select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name='tenant_id' and is_nullable='NO' and data_type='uuid'",
        [t.relname],
      );
      expect(col.rowCount, `${t.relname}: tenant_id uuid NOT NULL`).toBe(1);
      const pol = await admin.query(
        "select 1 from pg_policies where schemaname='public' and tablename=$1",
        [t.relname],
      );
      expect(pol.rowCount, `${t.relname}: has a policy`).toBeGreaterThan(0);
    }
    await admin.end();
  });
});

describe('tenant isolation', () => {
  it('a tenant reads only its own rows', async () => {
    const rows = await withTenant(db, { tenantId: tenantA }, (tx) =>
      tx.selectFrom('rlsProbeParents').selectAll().execute(),
    );
    expect(rows.map((r) => r.name)).toEqual(['A-parent']);
  });

  it('cannot read another tenant row even by exact id, nor by raw SQL', async () => {
    const byId = await withTenant(db, { tenantId: tenantA }, (tx) =>
      tx.selectFrom('rlsProbeParents').selectAll().where('id', '=', parentB).executeTakeFirst(),
    );
    expect(byId).toBeUndefined();
    const raw = await withTenant(db, { tenantId: tenantA }, (tx) =>
      sql<{
        name: string;
      }>`select name from rls_probe_parents where id = ${parentB}::uuid or true`.execute(tx),
    );
    expect(raw.rows.map((r) => r.name)).toEqual(['A-parent']);
  });

  it('cannot update or delete another tenant row (0 rows affected) and the row survives', async () => {
    const upd = await withTenant(db, { tenantId: tenantA }, (tx) =>
      tx
        .updateTable('rlsProbeParents')
        .set({ name: 'hacked' })
        .where('id', '=', parentB)
        .executeTakeFirst(),
    );
    expect(Number(upd.numUpdatedRows)).toBe(0);
    const del = await withTenant(db, { tenantId: tenantA }, (tx) =>
      tx.deleteFrom('rlsProbeParents').where('id', '=', parentB).executeTakeFirst(),
    );
    expect(Number(del.numDeletedRows)).toBe(0);
    const still = await withTenant(db, { tenantId: tenantB }, (tx) =>
      tx.selectFrom('rlsProbeParents').select('name').where('id', '=', parentB).executeTakeFirst(),
    );
    expect(still?.name).toBe('B-parent');
  });

  it('cannot insert a row for another tenant (RLS WITH CHECK, 42501)', async () => {
    const code = await pgCode(
      withTenant(db, { tenantId: tenantA }, (tx) =>
        tx.insertInto('rlsProbeParents').values({ tenantId: tenantB, name: 'planted' }).execute(),
      ),
    );
    expect(code).toBe('42501');
  });

  it('cannot move its own row to another tenant (42501)', async () => {
    const code = await pgCode(
      withTenant(db, { tenantId: tenantA }, (tx) =>
        tx
          .updateTable('rlsProbeParents')
          .set({ tenantId: tenantB })
          .where('id', '=', parentA)
          .execute(),
      ),
    );
    expect(code).toBe('42501');
  });

  it('foreign key cannot link to another tenant parent (composite FK, 23503)', async () => {
    const code = await pgCode(
      withTenant(db, { tenantId: tenantA }, (tx) =>
        tx
          .insertInto('rlsProbeChildren')
          .values({ tenantId: tenantA, parentId: parentB, note: 'cross-link' })
          .execute(),
      ),
    );
    expect(code).toBe('23503');
    const children = await withTenant(db, { tenantId: tenantB }, (tx) =>
      tx.selectFrom('rlsProbeChildren').select('note').execute(),
    );
    expect(children.map((c) => c.note)).toEqual(['B-child']);
  });

  it('parallel requests of different tenants never see each other', async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => {
        const tenantId = i % 2 === 0 ? tenantA : tenantB;
        return withTenant(db, { tenantId }, async (tx) => ({
          tenantId,
          names: (await tx.selectFrom('rlsProbeParents').select('name').execute()).map(
            (r) => r.name,
          ),
        }));
      }),
    );
    for (const r of results)
      expect(r.names).toEqual([r.tenantId === tenantA ? 'A-parent' : 'B-parent']);
  });
});

describe('missing or leaked context', () => {
  it('without app.tenant_id the app role sees nothing and cannot write', async () => {
    const rows = await db.selectFrom('rlsProbeParents').selectAll().execute();
    expect(rows).toEqual([]);
    const code = await pgCode(
      db.insertInto('rlsProbeParents').values({ tenantId: tenantA, name: 'x' }).execute(),
    );
    expect(code).toBe('42501');
  });

  it('the tenant setting does not leak to the next request on the same pooled connection', async () => {
    const single = createDb(testDb.appUrl, 1); // one connection => guaranteed reuse
    try {
      const inside = await withTenant(single, { tenantId: tenantA }, (tx) =>
        tx.selectFrom('rlsProbeParents').select('name').execute(),
      );
      expect(inside).toHaveLength(1);
      const after = await single.selectFrom('rlsProbeParents').select('name').execute();
      expect(after).toEqual([]);
    } finally {
      await single.destroy();
    }
  });

  it('the owner (migrator) is also subject to RLS because of FORCE', async () => {
    const owner = createDb(testDb.migratorUrl, 1);
    try {
      const rows = await owner.selectFrom('rlsProbeParents').selectAll().execute();
      expect(rows).toEqual([]);
    } finally {
      await owner.destroy();
    }
  });

  it('withTenant rejects a tenantId that is not a UUID', async () => {
    await expect(
      withTenant(db, { tenantId: "x'; drop table rls_probe_parents; --" }, async () => 1),
    ).rejects.toThrow(/UUID/);
  });
});
