import { CamelCasePlugin, Kysely, PostgresDialect, type Transaction } from 'kysely';
import { Pool } from 'pg';
import type { DB } from './db-types.ts';

export type Database = Kysely<DB>;
export type Tx = Transaction<DB>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Connect as the APP role (never owner, never BYPASSRLS). */
export const createDb = (connectionString: string, max = 10): Database =>
  new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString, max }) }),
    plugins: [new CamelCasePlugin()],
  });

export type TenantContext = { tenantId: string };

/**
 * Runs `fn` in a transaction scoped to one tenant. Every request-time query must go through here.
 * set_config(..., true) is SET LOCAL: the value dies with the transaction, so it can never leak
 * to the next request that reuses the pooled connection.
 */
export const withTenant = async <T>(
  db: Database,
  ctx: TenantContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> => {
  if (!UUID.test(ctx.tenantId)) throw new Error('withTenant: tenantId must be a UUID');
  return db.transaction().execute(async (tx) => {
    await tx
      .selectNoFrom((eb) =>
        eb.fn('set_config', [eb.val('app.tenant_id'), eb.val(ctx.tenantId), eb.val(true)]).as('t'),
      )
      .execute();
    return fn(tx);
  });
};
