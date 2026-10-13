/**
 * The explicit request context (docs/CONVENTIONS.md 7):
 *   { tenantId, userId, scope, tx, clock, requestId }
 *
 * It is threaded through every call by hand — no globals, no AsyncLocalStorage for
 * business logic. That is what makes the tenant boundary auditable: a repository
 * function cannot obtain a database handle without being handed one that carries
 * `tx`.
 *
 * `clock` is injected so that business code never calls `new Date()`
 * (docs/CONVENTIONS.md 6).
 */
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../db/types.ts';
import type { Clock } from './clock.ts';

/**
 * The database handles a repository may receive: a transaction (always, in
 * practice) or a plain connection. Both expose the query builder, and neither can
 * start a transaction through a repository's API surface.
 */
export type DbExecutor = Kysely<Database> | Transaction<Database>;

/** A permission identifier such as `cheques.issued.print` (docs/CONVENTIONS.md 4). */
export type Permission = string;

/**
 * Data scope of the caller, applied by repositories through `applyScope`
 * (docs/CONVENTIONS.md 9). A record outside the scope is a 404, not a 403.
 */
export interface Scope {
  /** Empty means "every company of this tenant that the caller may see". */
  companyIds: readonly string[];
  /** Empty means "every bank account the caller may see". */
  bankAccountIds: readonly string[];
}

export const TENANT_WIDE_SCOPE: Scope = { companyIds: [], bankAccountIds: [] };

/** Everything a service needs except the transaction. */
export interface RequestContext {
  tenantId: string;
  userId: string;
  scope: Scope;
  permissions: readonly Permission[];
  clock: Clock;
  requestId: string;
}

/**
 * A request context bound to an open transaction. Repositories only accept this
 * type, so a repository cannot run outside a `SET LOCAL app.tenant_id`
 * transaction — the type system refuses it.
 */
export interface TenantContext extends RequestContext {
  tx: DbExecutor;
}

export function hasPermission(ctx: RequestContext, permission: Permission): boolean {
  return ctx.permissions.includes(permission);
}

/** Fail-closed scope helper for repositories: apply `WHERE ... = ANY(...)` when scoped. */
export function isScoped(scope: Scope): boolean {
  return scope.companyIds.length > 0 || scope.bankAccountIds.length > 0;
}
