import type { Client } from 'pg';

export const APP_ROLE = 'cheques_app';
export const MIGRATOR_ROLE = 'cheques_migrator';

const quoteLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/**
 * Creates (or resets) the two database roles. Run once per database by an administrator.
 * - migrator: owns the schema, runs migrations, no superuser.
 * - app: what the API connects as. NOT owner, NOSUPERUSER, NOBYPASSRLS, so RLS always applies.
 */
export const bootstrapRoles = async (
  admin: Client,
  database: string,
  passwords: { app: string; migrator: string },
): Promise<void> => {
  for (const [role, password] of [
    [APP_ROLE, passwords.app],
    [MIGRATOR_ROLE, passwords.migrator],
  ] as const) {
    const exists = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
    const verb = exists.rowCount ? 'ALTER' : 'CREATE';
    await admin.query(
      `${verb} ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD ${quoteLiteral(password)}`,
    );
  }
  await admin.query(`GRANT CONNECT ON DATABASE "${database}" TO ${APP_ROLE}, ${MIGRATOR_ROLE}`);
  await admin.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${MIGRATOR_ROLE}`);
  await admin.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
};
