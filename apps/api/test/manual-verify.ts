/**
 * Fallback runner: executes the assertions of the non-database suites with plain
 * Node, because Vitest cannot start in the DSH sandbox on this development machine
 * (Vite's config loader asks esbuild to spawn a service process, and the sandbox
 * denies child processes with piped stdio: `spawn EPERM`).
 *
 * This file is NOT a substitute for the Vitest suite and does not claim to be:
 *   1. the Vitest suite is the source of truth and runs in CI;
 *   2. this harness exists so that the same assertions can be exercised locally
 *      with a tool that does run here;
 *   3. it only covers the suites that need no database. Nothing it prints may be
 *      read as "the isolation proof passed".
 *
 * Usage: `node apps/api/test/manual-verify.ts` from the repository root.
 * Exit code 0 = every check passed, 1 = at least one failed, 2 = harness error.
 */
import assert from 'node:assert/strict';
import request from 'supertest';
import { buildTestApp, identityHeaders, TEST_REQUEST_TIME } from './support/test-app.ts';
import { TENANT_A } from '../src/db/seed.ts';
import { decimalAmountSchema, formatDecimalAmount } from '../src/demo/demo-items.service.ts';
import { isUuidV7, uuidv7 } from '../src/http/ids.ts';
import { findCatalogViolations, type CatalogSnapshot } from './support/catalog-rules.ts';
import { loadMigrationFiles, sha256 } from '../src/db/migrate.ts';
import { writeOut } from '../src/config/cli-output.ts';

const USER_ID = '01890000-0000-7000-8000-0000000000aa';
const { app } = buildTestApp();

let passed = 0;
const failures: string[] = [];

async function check(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    writeOut(`PASS  ${name}`);
  } catch (error) {
    failures.push(name);
    writeOut(`FAIL  ${name}`);
    writeOut(`      ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
  }
}

function snapshot(overrides: Partial<CatalogSnapshot> = {}): CatalogSnapshot {
  return {
    tables: [],
    tablesWithTenantId: [],
    tablesWithRlsEnabled: [],
    tablesWithRlsForced: [],
    tablesWithPolicy: [],
    tenantIdNotNull: [],
    ...overrides,
  };
}

const DATABASE_URL = process.env['DATABASE_URL'];
writeOut(
  DATABASE_URL === undefined || DATABASE_URL === ''
    ? 'INFO  DATABASE_URL is unset: the tenant-isolation and RLS suites are NOT verified here ' +
        '(they are skipped in Vitest, and this harness does not run them at all).'
    : 'INFO  DATABASE_URL is set: run `npm run migrate` and `npx vitest run apps/api` for the ' +
        'database-backed suites; this harness still does not execute them.',
);
writeOut('');

// ---------------------------------------------------------------------------
// src/http/ids.ts
// ---------------------------------------------------------------------------
await check('uuidv7 produces an RFC 9562 version-7 uuid', () => {
  const id = uuidv7(1_700_000_000_000);
  assert.equal(isUuidV7(id), true);
  assert.equal(id[14], '7');
  assert.ok(['8', '9', 'a', 'b'].includes(id[19] ?? ''));
});

await check('uuidv7 is unique and ordered inside one millisecond', () => {
  const ids = Array.from({ length: 50 }, () => uuidv7(1_700_000_000_000));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), ids);
});

await check('uuidv7 keeps order and uniqueness well past one counter byte', () => {
  // Regression guard: the counter was once truncated by the version nibble.
  const ids = Array.from({ length: 5_000 }, () => uuidv7(1_700_000_000_000));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), ids);
});

await check('uuidv7 stays monotonic against the real wall clock', () => {
  const ids = Array.from({ length: 2_000 }, () => uuidv7());
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), ids);
});

await check('uuidv7 orders ids by timestamp across milliseconds', () => {
  assert.ok(uuidv7(1_700_000_000_000) < uuidv7(1_700_000_001_000));
});

// ---------------------------------------------------------------------------
// money: decimal strings only
// ---------------------------------------------------------------------------
await check('formatDecimalAmount pads to 4 fraction digits without rounding', () => {
  assert.equal(formatDecimalAmount('3355.515'), '3355.5150');
  assert.equal(formatDecimalAmount('515'), '515.0000');
  assert.equal(formatDecimalAmount('514.9999'), '514.9999');
  assert.equal(typeof formatDecimalAmount('514.9999'), 'string');
});

await check('the amount schema REJECTS a JSON number', () => {
  const result = decimalAmountSchema.safeParse(3355.515);
  assert.equal(result.success, false);
});

await check('the amount schema rejects too many fraction digits and signs', () => {
  assert.equal(decimalAmountSchema.safeParse('1.23456').success, false);
  assert.equal(decimalAmountSchema.safeParse('1e3').success, false);
  assert.equal(decimalAmountSchema.safeParse('-5.0000').success, false);
  assert.equal(decimalAmountSchema.safeParse('3355.5150').success, true);
});

// ---------------------------------------------------------------------------
// catalog rules: the detection logic, including unprotected fixtures
// ---------------------------------------------------------------------------
await check('catalog rules pass a fully protected table', () => {
  const violations = findCatalogViolations(
    snapshot({
      tables: ['demo_items'],
      tablesWithTenantId: ['demo_items'],
      tenantIdNotNull: ['demo_items'],
      tablesWithRlsEnabled: ['demo_items'],
      tablesWithRlsForced: ['demo_items'],
      tablesWithPolicy: ['demo_items'],
    }),
  );
  assert.deepEqual(violations, []);
});

await check('catalog rules FLAG an unprotected fixture table (the test can fail)', () => {
  const violations = findCatalogViolations(snapshot({ tables: ['scratch_unprotected_fixture'] }));
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.table, 'scratch_unprotected_fixture');
  assert.equal(violations[0]?.rule, 'tenant_id');
});

await check('catalog rules flag missing ENABLE, missing FORCE and missing policy', () => {
  const missingAll = findCatalogViolations(
    snapshot({ tables: ['t'], tablesWithTenantId: ['t'], tenantIdNotNull: ['t'] }),
  );
  assert.deepEqual(
    missingAll.map((violation) => violation.rule),
    ['rls_enabled', 'rls_forced', 'policy'],
  );

  const notForced = findCatalogViolations(
    snapshot({
      tables: ['t'],
      tablesWithTenantId: ['t'],
      tenantIdNotNull: ['t'],
      tablesWithRlsEnabled: ['t'],
      tablesWithPolicy: ['t'],
    }),
  );
  assert.deepEqual(
    notForced.map((violation) => violation.rule),
    ['rls_forced'],
  );
});

// ---------------------------------------------------------------------------
// HTTP: envelope, requestId, identity, validation
// ---------------------------------------------------------------------------
await check('GET /health answers the success envelope with the injected clock', async () => {
  const response = await request(app).get('/health').expect(200);
  assert.equal(response.body.data.status, 'ok');
  assert.equal(response.body.data.time, TEST_REQUEST_TIME);
  assert.equal(response.headers['x-request-id'], response.body.meta.requestId);
});

await check('an unknown route answers 404 with the standard error envelope', async () => {
  const response = await request(app).get('/nope').expect(404);
  assert.deepEqual(response.body.error.code, 'NOT_FOUND');
  assert.equal(response.body.error.message, 'No route matches GET /nope');
  assert.equal(response.body.error.requestId, response.headers['x-request-id']);
  assert.equal(response.body.error.details, undefined);
  assert.equal(response.body.data, undefined);
});

await check('a missing identity header answers 401, not 500', async () => {
  const response = await request(app).get('/api/v1/demo-items').expect(401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
  assert.equal(response.body.error.message, 'Missing identity header: x-tenant-id');
});

await check('a malformed identity header answers 401', async () => {
  const response = await request(app)
    .get('/api/v1/demo-items')
    .set('x-tenant-id', 'not-a-uuid')
    .set('x-user-id', USER_ID)
    .expect(401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
});

await check('a validation failure answers 400 with the field paths in details', async () => {
  const response = await request(app)
    .post('/api/v1/demo-items')
    .set(identityHeaders(TENANT_A.tenantId, USER_ID))
    .send({ label: '', amount: 3355.515, currency: 'jd' })
    .expect(400);

  assert.equal(response.body.error.code, 'VALIDATION_FAILED');
  const paths = response.body.error.details.issues.map((issue: { path: string }) => issue.path);
  assert.ok(paths.includes('label'));
  assert.ok(paths.includes('amount'));
  assert.ok(paths.includes('currency'));
});

await check('a non-uuid path parameter answers 400 with the (root) path', async () => {
  const response = await request(app)
    .get('/api/v1/demo-items/12')
    .set(identityHeaders(TENANT_A.tenantId, USER_ID))
    .expect(400);
  assert.equal(response.body.error.code, 'VALIDATION_FAILED');
  assert.equal(response.body.error.details.issues[0].path, '(root)');
});

await check('a safe inbound request id is reused, an unsafe one is replaced', async () => {
  const reused = await request(app).get('/health').set('x-request-id', 'trace-123').expect(200);
  assert.equal(reused.body.meta.requestId, 'trace-123');

  const replaced = await request(app)
    .get('/health')
    .set('x-request-id', 'bad id with spaces')
    .expect(200);
  assert.notEqual(replaced.body.meta.requestId, 'bad id with spaces');
});

// ---------------------------------------------------------------------------
// migration files (static: no database needed)
// ---------------------------------------------------------------------------
await check('every migration file loads in order with a stable SHA-256 checksum', async () => {
  const files = await loadMigrationFiles();
  assert.deepEqual(
    files.map((file) => file.version),
    [
      '0001_roles',
      '0002_schema_migrations',
      '0003_demo_items',
      '0004_uuid_v7',
      '0005_demo_attachments',
    ],
  );
  for (const file of files) {
    assert.equal(file.checksum, sha256(file.sql));
    assert.match(file.version, /^\d{4}_[a-z0-9_]+$/);
  }
});

await check(
  'every table-creating migration has the tenant quartet (or is allow-listed)',
  async () => {
    const files = await loadMigrationFiles();
    const allowListed = ['schema_migrations'];

    for (const file of files) {
      const created = [...file.sql.matchAll(/create table if not exists\s+([a-z_]+)/gi)].map(
        (match) => match[1] as string,
      );
      for (const table of created) {
        if (allowListed.includes(table)) continue;
        assert.match(
          file.sql,
          new RegExp(
            `create table if not exists\\s+${table}\\s*\\([\\s\\S]*?tenant_id\\s+uuid\\s+not null`,
            'i',
          ),
          `${file.version}: ${table} has no tenant_id uuid NOT NULL`,
        );
        assert.ok(
          file.sql.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`),
          `${file.version}: ${table} does not ENABLE ROW LEVEL SECURITY`,
        );
        assert.ok(
          file.sql.includes(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`),
          `${file.version}: ${table} does not FORCE ROW LEVEL SECURITY`,
        );
        assert.match(
          file.sql,
          new RegExp(`create policy\\s+\\S+\\s+on\\s+${table}\\b`, 'i'),
          `${file.version}: ${table} has no policy`,
        );
      }
    }
  },
);

await check('no migration uses a floating point type for money', async () => {
  const files = await loadMigrationFiles();
  for (const file of files) {
    // Comments are stripped: a migration is allowed to say "never a float".
    const sql = file.sql
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--[^\n]*/g, ' ')
      .toLowerCase();
    assert.doesNotMatch(sql, /\b(float|real|double\s+precision)\b/);
    assert.doesNotMatch(sql, /\bnumeric\s*[,(]?\s*\)/);
  }
});

writeOut('');
writeOut(`checks passed: ${passed}, failed: ${failures.length}`);
if (failures.length > 0) {
  writeOut(`failed checks:\n  - ${failures.join('\n  - ')}`);
  process.exitCode = 1;
}
