import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { bootstrapRoles, migrate } from './index.ts';

export type TestDatabase = {
  appUrl: string;
  migratorUrl: string;
  adminUrl: string;
  stop: () => Promise<void>;
};

const withDatabase = (url: string, database: string): string => {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
};

const withUser = (url: string, user: string, password: string): string => {
  const u = new URL(url);
  u.username = user;
  u.password = password;
  return u.toString();
};

/**
 * A fresh, migrated database for integration tests.
 * - TEST_DATABASE_ADMIN_URL set: uses that PostgreSQL server (superuser URL) and creates a throwaway database.
 * - Otherwise starts a PostgreSQL 17 Testcontainer (needs Docker; this is what CI does).
 */
export const startTestDatabase = async (): Promise<TestDatabase> => {
  let serverUrl = process.env['TEST_DATABASE_ADMIN_URL'];
  let stopContainer = async (): Promise<void> => {};

  if (!serverUrl) {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const container = await new PostgreSqlContainer('postgres:17-bookworm').start();
    serverUrl = container.getConnectionUri();
    stopContainer = async () => {
      await container.stop();
    };
  }

  const dbName = `cheques_test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const adminServer = new Client({ connectionString: serverUrl });
  await adminServer.connect();
  await adminServer.query(`CREATE DATABASE "${dbName}"`);
  await adminServer.end();

  const adminUrl = withDatabase(serverUrl, dbName);
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await bootstrapRoles(admin, dbName, { app: 'app-test-pw', migrator: 'migrator-test-pw' });
  await admin.end();

  const migratorUrl = withUser(adminUrl, 'cheques_migrator', 'migrator-test-pw');
  await migrate(migratorUrl);

  return {
    adminUrl,
    migratorUrl,
    appUrl: withUser(adminUrl, 'cheques_app', 'app-test-pw'),
    stop: async () => {
      const server = new Client({ connectionString: serverUrl });
      await server.connect();
      await server.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      await server.end();
      await stopContainer();
    },
  };
};
