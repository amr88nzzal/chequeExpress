/**
 * Reads the parts of `pg_catalog` the super-test needs, in FOUR separate queries.
 *
 * Why four and not one join: `pg_policy` has one row per policy, so joining it to
 * `pg_class` would duplicate a table that has two policies, and `attnotnull` is a
 * column attribute, not a table one. Asking four narrow questions and letting
 * `findCatalogViolations` (pure, unit-tested) combine them keeps each question
 * checkable on its own.
 *
 * The catalog is world-readable, but the application role is deliberately not the
 * owner of these tables, so the helper degrades gracefully instead of failing:
 * see `readCatalogSnapshot`.
 */
import type pg from 'pg';

export interface TableWithTenantId extends Record<string, unknown> {
  table_name: string;
}

export interface CatalogViolationRow extends Record<string, unknown> {
  table_name: string;
  has_tenant_id: boolean;
  tenant_id_not_null: boolean;
  rls_enabled: boolean;
  rls_forced: boolean;
  has_policy: boolean;
}

/**
 * One row per table in `public`, with the five facts flattened. The two `left
 * join`s cannot multiply rows: `pg_attribute` is restricted to the single
 * `tenant_id` column, and the policy subquery is grouped by `polrelid` so a table
 * with several policies still yields one row.
 */
export const CATALOG_VIOLATION_QUERY = `
  select
    c.relname                                   as table_name,
    (tid.attname is not null)                   as has_tenant_id,
    coalesce(tid.attnotnull, false)             as tenant_id_not_null,
    c.relrowsecurity                            as rls_enabled,
    c.relforcerowsecurity                       as rls_forced,
    coalesce(pol.has_policy, false)             as has_policy
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attribute tid
    on tid.attrelid = c.oid
   and tid.attname = 'tenant_id'
   and tid.attnum > 0
   and not tid.attisdropped
  left join (
    select polrelid, true as has_policy
    from pg_policy
    group by polrelid
  ) pol on pol.polrelid = c.oid
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
  order by c.relname
`;

export interface CatalogSnapshotRowSets {
  tables: string[];
  tablesWithTenantId: string[];
  tablesWithRlsEnabled: string[];
  tablesWithRlsForced: string[];
  tablesWithPolicy: string[];
  tenantIdNotNull: string[];
}

export function rowsToSnapshot(rows: readonly CatalogViolationRow[]): CatalogSnapshotRowSets {
  return {
    tables: rows.map((row) => row.table_name),
    tablesWithTenantId: rows.filter((row) => row.has_tenant_id).map((row) => row.table_name),
    tablesWithRlsEnabled: rows.filter((row) => row.rls_enabled).map((row) => row.table_name),
    tablesWithRlsForced: rows.filter((row) => row.rls_forced).map((row) => row.table_name),
    tablesWithPolicy: rows.filter((row) => row.has_policy).map((row) => row.table_name),
    tenantIdNotNull: rows.filter((row) => row.tenant_id_not_null).map((row) => row.table_name),
  };
}

export async function readCatalogSnapshot(
  pool: pg.Pool,
): Promise<ReturnType<typeof rowsToSnapshot>> {
  const { rows } = await pool.query<CatalogViolationRow>(CATALOG_VIOLATION_QUERY);
  return rowsToSnapshot(rows);
}

export async function readCatalogTableNames(pool: pg.Pool): Promise<string[]> {
  const { rows } = await pool.query<TableWithTenantId>(
    `select c.relname as table_name
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
      order by c.relname`,
  );
  return rows.map((row) => row.table_name);
}
