/**
 * The demo module's service layer: validation, business rules, and the
 * transaction. This is the only layer that calls `withTenant`
 * (docs/CONVENTIONS.md 7).
 *
 * Two rules are visible here rather than hidden in the route:
 *  - a record that is missing OR outside the caller's tenant is reported as
 *    404/NOT_FOUND, never 403, so a tenant cannot probe for another tenant's ids
 *    (docs/CONVENTIONS.md 9);
 *  - an update or delete that matches no row is a 404 even though the row may
 *    exist in another tenant: the RLS policy made it invisible, which is exactly
 *    the intended behaviour.
 *
 * Amounts stay decimal strings throughout; `formatDecimalAmount` only normalises
 * the textual shape, it never converts to a JavaScript number.
 */
import { z } from 'zod';
import { notFound } from '../http/errors.ts';
import type { Clock } from '../http/clock.ts';
import type { RequestContext, TenantContext } from '../http/context.ts';
import type { Db } from '../db/tenant-transaction.ts';
import { withTenant } from '../db/tenant-transaction.ts';
import { uuidv7 } from '../http/ids.ts';
import type {
  DemoItemRepository,
  DemoItemRow,
  UpdateDemoItemData,
} from './demo-items.repository.ts';

export interface DemoItem {
  id: string;
  tenantId: string;
  label: string;
  /** Decimal string with 4 fraction digits, e.g. "3355.5150". Never a number. */
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoItemServiceDeps {
  db: Db;
  repository: DemoItemRepository;
  clock: Clock;
}

export interface DemoItemService {
  list(ctx: RequestContext, limit: number): Promise<DemoItem[]>;
  get(ctx: RequestContext, id: string): Promise<DemoItem>;
  create(ctx: RequestContext, input: CreateDemoItemInput): Promise<DemoItem>;
  update(ctx: RequestContext, id: string, input: UpdateDemoItemInput): Promise<DemoItem>;
  delete(ctx: RequestContext, id: string): Promise<void>;
}

export interface CreateDemoItemInput {
  label: string;
  amount: string;
  currency: string;
}

export interface UpdateDemoItemInput {
  label?: string;
  amount?: string;
  currency?: string;
}

export function createDemoItemService(deps: DemoItemServiceDeps): DemoItemService {
  const { db, repository, clock } = deps;

  return {
    async list(ctx, limit) {
      return withTenant(db, ctx, async (tenantCtx) => {
        const rows = await repository.list(tenantCtx, limit);
        return rows.map(toDemoItem);
      });
    },

    async get(ctx, id) {
      return withTenant(db, ctx, async (tenantCtx) => {
        const row = await repository.findById(tenantCtx, id);
        if (row === undefined) {
          throw notFound(`Demo item ${id} was not found`);
        }
        return toDemoItem(row);
      });
    },

    async create(ctx, input) {
      const id = uuidv7(clock.now().getTime());
      return withTenant(db, ctx, async (tenantCtx) => {
        const row = await repository.insert(tenantCtx, {
          id,
          label: input.label,
          amount: input.amount,
          currency: input.currency,
        });
        return toDemoItem(row);
      });
    },

    async update(ctx, id, input) {
      const changes = normaliseUpdate(input);
      return withTenant(db, ctx, async (tenantCtx) => {
        const row = await repository.update(tenantCtx, id, changes);
        if (row === undefined) {
          throw notFound(`Demo item ${id} was not found`);
        }
        return toDemoItem(row);
      });
    },

    async delete(ctx, id) {
      await withTenant(db, ctx, async (tenantCtx: TenantContext) => {
        const deleted = await repository.remove(tenantCtx, id);
        if (!deleted) {
          throw notFound(`Demo item ${id} was not found`);
        }
      });
    },
  };
}

function toDemoItem(row: DemoItemRow): DemoItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    label: row.label,
    // `pg` returns numeric as a string; normalise the textual shape rather than
    // pass through whatever the driver produced.
    amount: formatDecimalAmount(String(row.amount)),
    currency: row.currency,
    status: row.status,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

/**
 * `timestamptz` arrives from `pg` as a `Date`. The `unknown` parameter is
 * deliberate: the Kysely column types are branded, and accepting `unknown` here
 * forces the runtime check instead of letting a string slip through unchecked.
 */
function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Value is not a timestamp: ${String(value)}`);
  }
  return parsed.toISOString();
}

function normaliseUpdate(input: UpdateDemoItemInput): UpdateDemoItemData {
  return {
    label: input.label,
    amount: input.amount === undefined ? undefined : formatDecimalAmount(input.amount),
    currency: input.currency,
  };
}

// ---------------------------------------------------------------------------
// Amount validation: a decimal STRING only. `z.number()` is deliberately absent,
// so a client that sends `3355.515` as a JSON number is rejected with 400 instead
// of being silently converted through a float (docs/CONVENTIONS.md 6).
// ---------------------------------------------------------------------------

/** At most 14 integer digits (numeric(18,4) allows 14 before the point). */
const DECIMAL_AMOUNT_PATTERN = /^\d{1,14}(\.\d{1,4})?$/;

export const decimalAmountSchema = z
  .string({ invalid_type_error: 'amount must be a decimal string, not a number' })
  .trim()
  .regex(DECIMAL_AMOUNT_PATTERN, 'amount must match /^\\d{1,14}(\\.\\d{1,4})?$/');

export const createDemoItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  amount: decimalAmountSchema,
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'currency must be a 3-letter ISO 4217 code')
    .transform((value) => value.toUpperCase()),
});

export const updateDemoItemSchema = z
  .object({
    label: z.string().trim().min(1).max(200).optional(),
    amount: decimalAmountSchema.optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'currency must be a 3-letter ISO 4217 code')
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'at least one field must be provided',
  });

/**
 * Pads (never rounds) to 4 fraction digits so the transport shape matches the
 * column: "3355.515" becomes "3355.5150". Padding a decimal string is exact; a
 * number would not be.
 */
export function formatDecimalAmount(value: string): string {
  const [integer = '', fraction = ''] = value.trim().split('.');
  return `${integer}.${fraction.padEnd(4, '0')}`;
}
