/**
 * `npm run seed` entry point: deterministic fixtures for the isolation tests and
 * for a local manual run.
 *
 * The seed runs as the migration/owner role (`DATABASE_ADMIN_URL`, falling back to
 * `DATABASE_URL`) and inserts rows for TWO tenants on purpose. The test suite then
 * connects as the application role and proves it can only ever see one of them.
 *
 * The amounts below are decimal STRINGS and include a 4-fraction-digit value on
 * purpose (`123.4500`): that is the numeric(18,4) round trip the money rule is
 * about (docs/CONVENTIONS.md 6).
 */
import type pg from 'pg';

export interface DemoTenant {
  tenantId: string;
  itemId: string;
  attachmentId: string;
  label: string;
  amount: string;
  currency: string;
}

/**
 * Fixed ids so tests can assert exact behaviour without a lookup step. They are
 * valid UUIDv7 values (version nibble 7, RFC 4122 variant) and are obviously
 * fixtures, not production data.
 */
export const TENANT_A: DemoTenant = {
  tenantId: '01890000-0000-7000-8000-000000000001',
  itemId: '01890000-0000-7000-8000-000000000101',
  attachmentId: '01890000-0000-7000-8000-0000000001a1',
  label: 'tenant-a-demo-item',
  amount: '3355.5150',
  currency: 'JOD',
};

export const TENANT_B: DemoTenant = {
  tenantId: '01890000-0000-7000-8000-000000000002',
  itemId: '01890000-0000-7000-8000-000000000102',
  attachmentId: '01890000-0000-7000-8000-0000000001a2',
  label: 'tenant-b-demo-item',
  amount: '123.4500',
  currency: 'USD',
};

export const SEEDED_TENANTS: readonly DemoTenant[] = [TENANT_A, TENANT_B];

/**
 * Idempotent: deletes exactly the fixture rows (by id) and re-inserts them with
 * their explicit `tenant_id`, inside one transaction.
 */
export async function seedDemoData(pool: pg.Pool): Promise<readonly DemoTenant[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const tenant of SEEDED_TENANTS) {
      await client.query(
        `INSERT INTO demo_items (id, tenant_id, label, amount, currency, status)
         VALUES ($1, $2, $3, $4, $5, 'draft')
         ON CONFLICT (id) DO UPDATE
           SET label = EXCLUDED.label,
               amount = EXCLUDED.amount,
               currency = EXCLUDED.currency,
               updated_at = now()`,
        [tenant.itemId, tenant.tenantId, tenant.label, tenant.amount, tenant.currency],
      );

      await client.query(
        `INSERT INTO demo_attachments (id, tenant_id, demo_item_id, file_name, byte_size)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
           SET file_name = EXCLUDED.file_name,
               byte_size = EXCLUDED.byte_size`,
        [tenant.attachmentId, tenant.tenantId, tenant.itemId, `${tenant.label}.pdf`, 1024],
      );
    }

    await client.query('COMMIT');
    return SEEDED_TENANTS;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
