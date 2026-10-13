/**
 * Kysely database types.
 *
 * These types are HAND-WRITTEN and mirror `src/db/migrations/*.sql`. The project's
 * target is generated types (docs/CONVENTIONS.md 2: "Kysely مع ترحيلات SQL وتوليد
 * الأنواع"); until `kysely-codegen` runs as a build step, hand-written is the
 * documented interim. Two guards keep the mirror honest:
 *
 *  1. `test/db-types-drift.test.ts` compares these column lists against
 *     `information_schema.columns` in the database;
 *  2. `test/catalog-rls.test.ts` proves every one of these tables is tenant
 *     protected, so a table cannot be added to SQL without either being added here
 *     or failing the catalog super-test.
 *
 * Regenerate instead of editing by hand once the generator is wired into CI.
 *
 * COLUMN NAMING: the keys below are the real snake_case column names. The queries in
 * `src/demo/demo-items.repository.ts` list their columns explicitly instead of using
 * `selectAll()`, so there is no camelCase result type to model and the transport
 * shape stays explicit (`{ id, tenantId, amount, ... }`) rather than accidental.
 */
import type { Generated } from 'kysely';

/**
 * `numeric(18,4)` is read by `pg` as a STRING, which is exactly what the project
 * requires (docs/CONVENTIONS.md 6). Never widen `amount` to `number`.
 */
export type Decimal18_4 = string;

/**
 * `timestamptz`, delivered by `pg` as a `Date`. Kept as a plain alias rather than
 * `ColumnType<Date, Date | string, Date | string>`: nesting a branded `ColumnType`
 * inside `Generated` leaves Kysely's `UpdateType` inference with an unresolved
 * conditional, and `.set()` then rejects every value. Plain `Date` is also the
 * honest type — `pg` hands back a `Date` and accepts one on write.
 */
export type Timestamptz = Date;

export interface DemoItemsTable {
  id: Generated<string>;
  tenant_id: string;
  label: string;
  amount: Decimal18_4;
  currency: string;
  status: Generated<string>;
  created_at: Generated<Timestamptz>;
  /** Written from the injected clock (`ctx.clock`), never from `new Date()`. */
  updated_at: Generated<Timestamptz>;
}

export interface DemoAttachmentsTable {
  id: Generated<string>;
  tenant_id: string;
  demo_item_id: string;
  file_name: string;
  byte_size: number;
  created_at: Generated<Timestamptz>;
}

export interface Database {
  demoItems: DemoItemsTable;
  demoAttachments: DemoAttachmentsTable;
}

/**
 * The exact column list of each table, used by the drift test. Kept next to the
 * interfaces so the two are edited together.
 */
export const EXPECTED_COLUMNS: Readonly<Record<keyof Database, readonly string[]>> = {
  demoItems: [
    'id',
    'tenant_id',
    'label',
    'amount',
    'currency',
    'status',
    'created_at',
    'updated_at',
  ],
  demoAttachments: ['id', 'tenant_id', 'demo_item_id', 'file_name', 'byte_size', 'created_at'],
};
