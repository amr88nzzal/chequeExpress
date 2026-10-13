/**
 * THE ACCEPTANCE TEST OF STAGE C0 — tenant isolation over HTTP.
 *
 * A user of tenant A must not be able to read, update or delete a row of tenant B,
 * and the HTTP answer must be 404 (not 403): "not found" and "out of scope" are
 * deliberately indistinguishable so that a tenant cannot probe for another
 * tenant's identifiers (docs/CONVENTIONS.md 9).
 *
 * For this file to RUN instead of skip: `DATABASE_URL` must point at a database
 * where the migrations have been applied. Without it every test below is reported
 * as SKIPPED — never faked, never silently passed. See `test/support/db.ts` and
 * apps/api/README.md.
 *
 * The suite drives the API as the APPLICATION role (cheques_app), never as the
 * owner, so the RLS policy — not a privileged connection — is what enforces the
 * boundary. The database-layer proofs live in `test/isolation-proof.test.ts`.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import type pg from 'pg';
import { buildTestApp, identityHeaders } from './support/test-app.ts';
import {
  assertMigrationsApplied,
  createAdminPool,
  createAppDb,
  hasDatabase,
  migrateAndSeed,
  SKIP_REASON,
} from './support/db.ts';
import { TENANT_A, TENANT_B } from '../src/db/seed.ts';
import type { Db } from '../src/db/tenant-transaction.ts';
import { sqlSetLocalTenant } from '../src/db/tenant-transaction.ts';
import { fixedClock } from '../src/http/clock.ts';

const USER_A = '01890000-0000-7000-8000-0000000000a1';
const USER_B = '01890000-0000-7000-8000-0000000000b1';

if (SKIP_REASON !== null) {
  console.warn(`[tenant isolation] SKIPPED: ${SKIP_REASON}`);
}

describe.skipIf(!hasDatabase)('tenant isolation — HTTP (acceptance)', () => {
  let adminPool: pg.Pool;
  let appDb: Db;
  let appPool: pg.Pool;
  let app: ReturnType<typeof buildTestApp>['app'];

  beforeAll(async () => {
    adminPool = createAdminPool();
    await migrateAndSeed(adminPool);
    await assertMigrationsApplied(adminPool);

    const appHandle = createAppDb();
    appDb = appHandle.db;
    appPool = appHandle.pool;

    app = buildTestApp({ db: appDb, clock: fixedClock('2026-01-01T00:00:00.000Z') }).app;
  }, 60_000);

  afterAll(async () => {
    await appDb.destroy();
    await appPool.end().catch(() => undefined);
    await adminPool.end().catch(() => undefined);
  });

  beforeEach(async () => {
    // Re-assert the fixtures after any test in this file that writes.
    await migrateAndSeed(adminPool);
  });

  it('READ: tenant A cannot read tenant B (404, not 403)', async () => {
    const own = await request(app)
      .get(`/api/v1/demo-items/${TENANT_A.itemId}`)
      .set(identityHeaders(TENANT_A.tenantId, USER_A))
      .expect(200);
    expect(own.body.data.id).toBe(TENANT_A.itemId);
    expect(own.body.data.tenantId).toBe(TENANT_A.tenantId);

    const foreign = await request(app)
      .get(`/api/v1/demo-items/${TENANT_B.itemId}`)
      .set(identityHeaders(TENANT_A.tenantId, USER_A))
      .expect(404);

    expect(foreign.body.error.code).toBe('NOT_FOUND');
    // The answer must not reveal whether the row exists for somebody else.
    expect(foreign.body.error.message).not.toContain('permission');
  });

  it('UPDATE: tenant A cannot update tenant B (404, and the row is untouched)', async () => {
    await request(app)
      .patch(`/api/v1/demo-items/${TENANT_B.itemId}`)
      .set(identityHeaders(TENANT_A.tenantId, USER_A))
      .send({ label: 'hijacked-by-tenant-a' })
      .expect(404);

    // The row still belongs to B with its original label, which is what proves the
    // 404 came from a policy-filtered UPDATE rather than a lucky lookup.
    const stillB = await request(app)
      .get(`/api/v1/demo-items/${TENANT_B.itemId}`)
      .set(identityHeaders(TENANT_B.tenantId, USER_B))
      .expect(200);
    expect(stillB.body.data.label).toBe(TENANT_B.label);
  });

  it('DELETE: tenant A cannot delete tenant B (404, and the row survives)', async () => {
    await request(app)
      .delete(`/api/v1/demo-items/${TENANT_B.itemId}`)
      .set(identityHeaders(TENANT_A.tenantId, USER_A))
      .expect(404);

    const stillB = await request(app)
      .get(`/api/v1/demo-items/${TENANT_B.itemId}`)
      .set(identityHeaders(TENANT_B.tenantId, USER_B))
      .expect(200);
    expect(stillB.body.data.id).toBe(TENANT_B.itemId);
  });

  it('LIST: each tenant sees only its own rows, with the same request in both contexts', async () => {
    const listA = await request(app)
      .get('/api/v1/demo-items')
      .set(identityHeaders(TENANT_A.tenantId, USER_A))
      .expect(200);

    const listB = await request(app)
      .get('/api/v1/demo-items')
      .set(identityHeaders(TENANT_B.tenantId, USER_B))
      .expect(200);

    const idsA: string[] = listA.body.data.map((item: { id: string }) => item.id);
    const idsB: string[] = listB.body.data.map((item: { id: string }) => item.id);

    expect(idsA).toContain(TENANT_A.itemId);
    expect(idsA).not.toContain(TENANT_B.itemId);
    expect(idsB).toContain(TENANT_B.itemId);
    expect(idsB).not.toContain(TENANT_A.itemId);

    expect(
      listA.body.data.every((item: { tenantId: string }) => item.tenantId === TENANT_A.tenantId),
    ).toBe(true);
    expect(
      listB.body.data.every((item: { tenantId: string }) => item.tenantId === TENANT_B.tenantId),
    ).toBe(true);
  });

  it('CREATE: a tenant can create its own row and immediately read it back', async () => {
    const created = await request(app)
      .post('/api/v1/demo-items')
      .set(identityHeaders(TENANT_A.tenantId, USER_A))
      .send({ label: 'created-by-test', amount: '12.5000', currency: 'jod' })
      .expect(201);

    expect(created.body.data.tenantId).toBe(TENANT_A.tenantId);
    expect(created.body.data.amount).toBe('12.5000');
    expect(created.body.data.currency).toBe('JOD');

    const readBack = await request(app)
      .get(`/api/v1/demo-items/${created.body.data.id}`)
      .set(identityHeaders(TENANT_A.tenantId, USER_A))
      .expect(200);
    expect(readBack.body.data.id).toBe(created.body.data.id);
  });

  it('INSERT: the policy rejects a row whose tenant_id is not the claimed tenant', async () => {
    // The API cannot express this (tenant_id is never accepted from the body), so
    // the statement is sent directly: WITH CHECK is the last line of defence and it
    // must raise rather than write a foreign row.
    const error = await appDb.transaction().execute(async (tx) => {
      await sqlSetLocalTenant(tx, TENANT_A.tenantId);
      try {
        await sql`
          insert into demo_items (tenant_id, label, amount, currency)
          values (${TENANT_B.tenantId}::uuid, 'cross-tenant-insert', 1.0000, 'JOD')
        `.execute(tx);
        return null;
      } catch (caught) {
        return caught as { code?: string };
      }
    });

    // 42501 = insufficient_privilege, raised when a WITH CHECK policy rejects a row.
    expect(error?.code).toBe('42501');
  });
});
