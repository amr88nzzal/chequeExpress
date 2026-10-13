/**
 * The catalog super-test's detection logic, proven WITHOUT a database.
 *
 * These fixtures are the "temporarily add an unprotected table" proof required by
 * the stage-C0 acceptance criteria: the snapshot below contains tables that are
 * missing `tenant_id`, missing ENABLE, missing FORCE, and missing a policy, plus
 * one correctly protected table and one allow-listed global table. If the
 * detection logic ever stops flagging them, these tests fail.
 *
 * The SQL that produces the real snapshot lives in
 * `test/support/catalog-reader.ts` and is exercised by `test/catalog-rls.test.ts`
 * (skipped without DATABASE_URL).
 */
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_GLOBAL_TABLES,
  describeViolations,
  findCatalogViolations,
  type CatalogSnapshot,
} from './support/catalog-rules.ts';

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

describe('catalog rules: detection logic', () => {
  it('passes a fully protected table', () => {
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
    expect(violations).toEqual([]);
  });

  it('flags an unprotected fixture table that has no tenant_id', () => {
    const violations = findCatalogViolations(snapshot({ tables: ['scratch_unprotected_fixture'] }));
    expect(violations).toEqual([
      {
        table: 'scratch_unprotected_fixture',
        rule: 'tenant_id',
        message:
          'table "scratch_unprotected_fixture" has no tenant_id column and is not on the global allow-list',
      },
    ]);
  });

  it('flags tenant_id present but RLS not enabled', () => {
    const violations = findCatalogViolations(
      snapshot({ tables: ['t'], tablesWithTenantId: ['t'], tenantIdNotNull: ['t'] }),
    );
    expect(violations.map((violation) => violation.rule)).toEqual([
      'rls_enabled',
      'rls_forced',
      'policy',
    ]);
  });

  it('flags RLS enabled but not FORCED (the owner would see every tenant)', () => {
    const violations = findCatalogViolations(
      snapshot({
        tables: ['t'],
        tablesWithTenantId: ['t'],
        tenantIdNotNull: ['t'],
        tablesWithRlsEnabled: ['t'],
        tablesWithPolicy: ['t'],
      }),
    );
    expect(violations.map((violation) => violation.rule)).toEqual(['rls_forced']);
  });

  it('flags RLS enabled and forced but no policy', () => {
    const violations = findCatalogViolations(
      snapshot({
        tables: ['t'],
        tablesWithTenantId: ['t'],
        tenantIdNotNull: ['t'],
        tablesWithRlsEnabled: ['t'],
        tablesWithRlsForced: ['t'],
      }),
    );
    expect(violations.map((violation) => violation.rule)).toEqual(['policy']);
  });

  it('flags a nullable tenant_id', () => {
    const violations = findCatalogViolations(
      snapshot({
        tables: ['t'],
        tablesWithTenantId: ['t'],
        tablesWithRlsEnabled: ['t'],
        tablesWithRlsForced: ['t'],
        tablesWithPolicy: ['t'],
      }),
    );
    expect(violations.map((violation) => violation.rule)).toEqual(['tenant_id_not_null']);
  });

  it('exempts exactly the allow-listed global tables, and nothing else', () => {
    const allowed = [...ALLOWED_GLOBAL_TABLES.keys()];
    expect(findCatalogViolations(snapshot({ tables: allowed }))).toEqual([]);

    const violations = findCatalogViolations(snapshot({ tables: [...allowed, 'oops'] }));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.table).toBe('oops');
  });

  it('reports one line per violation, so a CI failure is readable', () => {
    const text = describeViolations(findCatalogViolations(snapshot({ tables: ['a', 'b'] })));
    expect(text.split('\n')).toHaveLength(2);
    expect(text).toContain('table "a" has no tenant_id column');
    expect(text).toContain('table "b" has no tenant_id column');
  });
});
