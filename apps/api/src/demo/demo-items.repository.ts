/**
 * Demo repository: SQL only. It never opens a transaction — it receives `ctx.tx`
 * from the service and cannot obtain a database handle any other way
 * (docs/CONVENTIONS.md 7).
 *
 * Every statement is tenant scoped twice over:
 *  1. `WHERE tenant_id = ctx.tenantId` is written explicitly, so the intent is
 *     readable and the tenant index is used;
 *  2. the RLS policy enforces the same predicate in the database, so a future edit
 *     that forgets (1) still cannot leak another tenant's rows.
 *
 * That redundancy is the reason the extra predicate is not "cleaned up".
 *
 * Columns are listed explicitly instead of using `selectAll()`, so the result shape
 * is `{ id, tenantId, ... }` and no CamelCasePlugin result mapping is required.
 */
import { sql, type Selectable } from 'kysely';
import type { DemoItemsTable } from '../db/types.ts';
import type { TenantContext } from '../http/context.ts';

/** Raw column names, as `pg` returns them. */
export type DemoItemRow = Selectable<DemoItemsTable>;

export interface CreateDemoItemData {
  id: string;
  label: string;
  amount: string;
  currency: string;
}

export interface UpdateDemoItemData {
  label?: string | undefined;
  amount?: string | undefined;
  currency?: string | undefined;
}

export interface DemoItemRepository {
  list(ctx: TenantContext, limit: number): Promise<DemoItemRow[]>;
  findById(ctx: TenantContext, id: string): Promise<DemoItemRow | undefined>;
  insert(ctx: TenantContext, data: CreateDemoItemData): Promise<DemoItemRow>;
  update(
    ctx: TenantContext,
    id: string,
    data: UpdateDemoItemData,
  ): Promise<DemoItemRow | undefined>;
  remove(ctx: TenantContext, id: string): Promise<boolean>;
  countAll(ctx: TenantContext): Promise<number>;
}

const ITEM_COLUMNS = [
  'id',
  'tenant_id',
  'label',
  'amount',
  'currency',
  'status',
  'created_at',
  'updated_at',
] as const;

export function createDemoItemRepository(): DemoItemRepository {
  return {
    async list(ctx, limit) {
      return ctx.tx
        .selectFrom('demoItems')
        .select(ITEM_COLUMNS)
        .where('tenant_id', '=', ctx.tenantId)
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
        .execute();
    },

    async findById(ctx, id) {
      return ctx.tx
        .selectFrom('demoItems')
        .select(ITEM_COLUMNS)
        .where('tenant_id', '=', ctx.tenantId)
        .where('id', '=', id)
        .executeTakeFirst();
    },

    async insert(ctx, data) {
      return ctx.tx
        .insertInto('demoItems')
        .values({
          id: data.id,
          tenant_id: ctx.tenantId,
          label: data.label,
          amount: data.amount,
          currency: data.currency,
        })
        .returning(ITEM_COLUMNS)
        .executeTakeFirstOrThrow();
    },

    async update(ctx, id, data) {
      // The clock is injected through `ctx`; business code never calls `new Date()`.
      // Fields are copied one by one so that `undefined` means "leave unchanged"
      // instead of "set to NULL".
      const changes = {
        // A `Date` from the injected clock, never `new Date()` in business code.
        // `pg` serialises it to a timestamptz literal for the session time zone.
        updated_at: ctx.clock.now(),
        ...(data.label === undefined ? {} : { label: data.label }),
        ...(data.amount === undefined ? {} : { amount: data.amount }),
        ...(data.currency === undefined ? {} : { currency: data.currency }),
      };

      return ctx.tx
        .updateTable('demoItems')
        .set(changes)
        .where('tenant_id', '=', ctx.tenantId)
        .where('id', '=', id)
        .returning(ITEM_COLUMNS)
        .executeTakeFirst();
    },

    async remove(ctx, id) {
      const result = await ctx.tx
        .deleteFrom('demoItems')
        .where('tenant_id', '=', ctx.tenantId)
        .where('id', '=', id)
        .executeTakeFirst();
      return Number(result.numDeletedRows) > 0;
    },

    async countAll(ctx) {
      // Deliberately WITHOUT a WHERE clause: the RLS proof uses this shape to show
      // that the policy — not application code — is what restricts the rows.
      const result = await ctx.tx
        .selectFrom('demoItems')
        .select(sql<string>`count(*)::text`.as('count'))
        .executeTakeFirstOrThrow();
      return Number(result.count);
    },
  };
}
