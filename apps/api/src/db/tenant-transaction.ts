/**
 * The tenant boundary at the database level: `withTenant` opens a transaction,
 * sets the tenant claim with `SET LOCAL`, hands the callback a context that
 * carries the transaction, and commits or rolls back.
 *
 * Two details are load-bearing:
 *
 *  - **`SET LOCAL`, never `SET`.** A plain `SET app.tenant_id` lives for the whole
 *    session; in a pooled connection the next request would inherit the previous
 *    tenant. `SET LOCAL` is scoped to the transaction and reverts on COMMIT or
 *    ROLLBACK (docs/CONVENTIONS.md 8).
 *
 *  - **`set_config(..., true)` rather than string interpolation.** The claim
 *    travels as a bind parameter, so a tenant id can never be concatenated into
 *    SQL. (`SET LOCAL app.tenant_id = '...'` cannot be parameterised at all.)
 *
 * The transaction is opened here, in the service layer, and never in a
 * repository (docs/CONVENTIONS.md 7). Repositories receive `ctx.tx`.
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from './types.ts';
import type { RequestContext, TenantContext } from '../http/context.ts';

export type Db = Kysely<Database>;
export type DbTransaction = Transaction<Database>;

export interface WithTenantOptions {
  /** Overrides `ctx.tenantId`; tests use it to run a query in another tenant. */
  tenantId?: string;
}

/**
 * Runs `fn` inside a transaction whose `app.tenant_id` is the caller's tenant.
 * The value is validated by PostgreSQL itself as a `uuid`: a malformed value
 * raises before any row is read or written.
 */
export async function withTenant<TResult>(
  db: Db,
  ctx: RequestContext,
  fn: (ctx: TenantContext) => Promise<TResult>,
  options: WithTenantOptions = {},
): Promise<TResult> {
  const tenantId = options.tenantId ?? ctx.tenantId;

  return db.transaction().execute(async (tx) => {
    await sqlSetLocalTenant(tx, tenantId);
    return fn({ ...ctx, tenantId, tx });
  });
}

/**
 * The single place in the codebase that writes `app.tenant_id`. Exported so the
 * seed CLI and tests reuse it instead of re-implementing `SET`.
 */
export async function sqlSetLocalTenant(
  tx: Kysely<Database> | Transaction<Database>,
  tenantId: string,
): Promise<void> {
  await sql`select set_config('app.tenant_id', ${tenantId}, true)`.execute(tx);
}
