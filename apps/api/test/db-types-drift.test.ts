/**
 * Guards the hand-written Kysely types against drift.
 *
 * The types in `src/db/types.ts` are hand-written (documented there and in
 * apps/api/README.md). This test fails when a migration adds, removes or renames a
 * column without the TypeScript mirror being updated — otherwise the mirror rots
 * silently and the first symptom is a runtime error in production.
 *
 * Skipped, with a loud reason, when DATABASE_URL is unset.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { EXPECTED_COLUMNS, type Database } from '../src/db/types.ts';
import {
  createAdminPool,
  createAppPool,
  hasDatabase,
  migrateAndSeed,
  SKIP_REASON,
} from './support/db.ts';

if (SKIP_REASON !== null) {
  console.warn(`[db-types drift] SKIPPED: ${SKIP_REASON}`);
}

describe.skipIf(!hasDatabase)('db types mirror the migrations', () => {
  let adminPool: pg.Pool;
  let appPool: pg.Pool;

  beforeAll(async () => {
    adminPool = createAdminPool();
    await migrateAndSeed(adminPool);
    appPool = createAppPool();
  }, 60_000);

  afterAll(async () => {
    await appPool?.end().catch(() => undefined);
    await adminPool?.end().catch(() => undefined);
  });

  it.each(Object.entries(EXPECTED_COLUMNS) as Array<[keyof Database, readonly string[]]>)(
    'table %s has exactly the mirrored columns',
    async (table, expected) => {
      const { rows } = await appPool.query<{ column_name: string }>(
        `select column_name
           from information_schema.columns
          where table_schema = 'public' and table_name = $1
          order by column_name`,
        [table],
      );

      expect(rows.map((row) => row.column_name)).toEqual([...expected].sort());
    },
  );

  it('every mirrored table exists', async () => {
    const { rows } = await appPool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_name = any($1::text[])`,
      [Object.keys(EXPECTED_COLUMNS)],
    );

    expect(rows.map((row) => row.table_name).sort()).toEqual(Object.keys(EXPECTED_COLUMNS).sort());
  });
});
