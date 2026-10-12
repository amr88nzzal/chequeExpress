// Measures the cost of RLS on 1M rows. Not part of CI (slow).
// Run:  TEST_DATABASE_ADMIN_URL=postgres://postgres:pw@host:5432/postgres pnpm --filter @cheques/api bench:rls
import { Client } from 'pg';
import { startTestDatabase } from './test-database.ts';

const ROWS = 1_000_000;
const TENANTS = 100;
const ITER = 300;

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const p95 = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)]!;

const time = async (fn: () => Promise<unknown>): Promise<{ med: number; p95: number }> => {
  for (let i = 0; i < 20; i++) await fn(); // warm-up
  const xs: number[] = [];
  for (let i = 0; i < ITER; i++) {
    const t = performance.now();
    await fn();
    xs.push(performance.now() - t);
  }
  return { med: median(xs), p95: p95(xs) };
};

const t = await startTestDatabase();
const admin = new Client({ connectionString: t.adminUrl });
const app = new Client({ connectionString: t.appUrl });
await admin.connect();
await app.connect();

console.log(`seeding ${ROWS} rows across ${TENANTS} tenants...`);
await admin.query(`
  INSERT INTO rls_probe_parents (tenant_id, name)
  SELECT ('00000000-0000-4000-8000-' || lpad((g % ${TENANTS})::text, 12, '0'))::uuid, 'row ' || g
    FROM generate_series(1, ${ROWS}) g`);
await admin.query('ANALYZE rls_probe_parents');

const tenant = '00000000-0000-4000-8000-000000000042';
const sample = await admin.query<{ id: string }>(
  'SELECT id FROM rls_probe_parents WHERE tenant_id = $1 LIMIT 1',
  [tenant],
);
const id = sample.rows[0]!.id;

const withRls = (query: string, params: unknown[]) => async () => {
  await app.query('BEGIN');
  await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenant]);
  await app.query(query, params);
  await app.query('COMMIT');
};
const baseline = (query: string, params: unknown[]) => async () => {
  await admin.query('BEGIN');
  await admin.query(query, params);
  await admin.query('COMMIT');
};

const cases: Array<{ name: string; rls: [string, unknown[]]; base: [string, unknown[]] }> = [
  {
    name: 'list 50 of one tenant (ORDER BY id)',
    rls: ['SELECT * FROM rls_probe_parents ORDER BY id LIMIT 50', []],
    base: ['SELECT * FROM rls_probe_parents WHERE tenant_id = $1 ORDER BY id LIMIT 50', [tenant]],
  },
  {
    name: 'point lookup by id',
    rls: ['SELECT * FROM rls_probe_parents WHERE id = $1', [id]],
    base: ['SELECT * FROM rls_probe_parents WHERE id = $1 AND tenant_id = $2', [id, tenant]],
  },
  {
    name: 'count rows of one tenant',
    rls: ['SELECT count(*) FROM rls_probe_parents', []],
    base: ['SELECT count(*) FROM rls_probe_parents WHERE tenant_id = $1', [tenant]],
  },
];

console.log(`\n${ROWS} rows, ${TENANTS} tenants, ${ITER} iterations (ms)\n`);
console.log('case'.padEnd(40), 'RLS med/p95'.padEnd(18), 'explicit WHERE med/p95');
for (const c of cases) {
  const a = await time(withRls(...c.rls));
  const b = await time(baseline(...c.base));
  console.log(
    c.name.padEnd(40),
    `${a.med.toFixed(2)} / ${a.p95.toFixed(2)}`.padEnd(18),
    `${b.med.toFixed(2)} / ${b.p95.toFixed(2)}`,
  );
}

const plan = await app.query('BEGIN').then(async () => {
  await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenant]);
  const r = await app.query('EXPLAIN SELECT * FROM rls_probe_parents WHERE id = $1', [id]);
  await app.query('COMMIT');
  return r.rows.map((x) => x['QUERY PLAN']).join('\n');
});
console.log(`\nplan (point lookup under RLS):\n${plan}`);

await app.end();
await admin.end();
await t.stop();
