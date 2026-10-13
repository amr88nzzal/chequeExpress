/**
 * The rules the catalog super-test applies, kept here so they are readable,
 * testable without a database, and impossible to bury inside a long SQL string.
 *
 * THE RULE (docs/CONVENTIONS.md 8): every table in schema `public`, except the
 * explicit global allow-list below, must have
 *   1. a `tenant_id uuid NOT NULL` column,
 *   2. row level security ENABLED,
 *   3. row level security FORCED,
 *   4. at least one policy.
 *
 * A table added without protection therefore FAILS this test. That is the point:
 * the invariant is enforced by CI, not by review.
 *
 * The allow-list is intentionally tiny and each entry must carry a reason. Adding
 * an entry is a deliberate, reviewable act; adding a protected table is not
 * required at all.
 */

export const ALLOWED_GLOBAL_TABLES: ReadonlyMap<string, string> = new Map([
  [
    'schema_migrations',
    'Migration ledger: infrastructure, no tenant data, SELECT-only for the app role.',
  ],
  ['countries', 'Global reference data (DESIGN.md 3).'],
  ['currencies', 'Global reference data (DESIGN.md 3).'],
  ['banks', 'Global bank directory (DESIGN.md 3).'],
  ['platform_cheque_layouts', 'Platform-wide cheque template library (DESIGN.md 9).'],
]);

export interface CatalogSnapshot {
  /** Every table in `public` (excluding system tables). */
  tables: readonly string[];
  /** Tables that have a `tenant_id` column. */
  tablesWithTenantId: readonly string[];
  /** Tables whose `relrowsecurity` is true. */
  tablesWithRlsEnabled: readonly string[];
  /** Tables whose `relforcerowsecurity` is true. */
  tablesWithRlsForced: readonly string[];
  /** Tables that have at least one policy in `pg_policy`. */
  tablesWithPolicy: readonly string[];
  /** Columns named `tenant_id` that are NOT NULL (for the nullability assertion). */
  tenantIdNotNull: readonly string[];
}

export interface CatalogViolation {
  table: string;
  rule: 'tenant_id' | 'tenant_id_not_null' | 'rls_enabled' | 'rls_forced' | 'policy';
  message: string;
}

/**
 * Pure rule evaluation: no database, no I/O. The integration test feeds it a real
 * catalog snapshot; the unit test feeds it hand-built snapshots, including a
 * deliberately unprotected fixture table, which is how the detection logic itself
 * is proven to detect.
 */
export function findCatalogViolations(snapshot: CatalogSnapshot): CatalogViolation[] {
  const hasTenantId = new Set(snapshot.tablesWithTenantId);
  const notNull = new Set(snapshot.tenantIdNotNull);
  const rlsEnabled = new Set(snapshot.tablesWithRlsEnabled);
  const rlsForced = new Set(snapshot.tablesWithRlsForced);
  const hasPolicy = new Set(snapshot.tablesWithPolicy);

  const violations: CatalogViolation[] = [];

  for (const table of [...snapshot.tables].sort()) {
    if (ALLOWED_GLOBAL_TABLES.has(table)) continue;

    if (!hasTenantId.has(table)) {
      violations.push({
        table,
        rule: 'tenant_id',
        message: `table "${table}" has no tenant_id column and is not on the global allow-list`,
      });
      // Without the column the remaining checks are noise; one violation is enough.
      continue;
    }

    if (!notNull.has(table)) {
      violations.push({
        table,
        rule: 'tenant_id_not_null',
        message: `table "${table}".tenant_id is nullable`,
      });
    }

    if (!rlsEnabled.has(table)) {
      violations.push({
        table,
        rule: 'rls_enabled',
        message: `row level security is not ENABLED on "${table}"`,
      });
    }

    if (!rlsForced.has(table)) {
      violations.push({
        table,
        rule: 'rls_forced',
        message: `row level security is not FORCED on "${table}"`,
      });
    }

    if (!hasPolicy.has(table)) {
      violations.push({
        table,
        rule: 'policy',
        message: `"${table}" has tenant_id and RLS but no policy, so no row is ever visible`,
      });
    }
  }

  return violations;
}

/** Human-readable failure detail: one line per violation. */
export function describeViolations(violations: readonly CatalogViolation[]): string {
  return violations.map((violation) => `- [${violation.rule}] ${violation.message}`).join('\n');
}
