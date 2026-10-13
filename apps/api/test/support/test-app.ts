/**
 * Builds the real HTTP application for tests, with every dependency injected.
 *
 * `db` is a parameter because two kinds of suite use this helper:
 *  - HTTP contract tests (health, envelopes) never execute a query, so they pass a
 *    throwing placeholder and run with no PostgreSQL at all;
 *  - the isolation acceptance test passes a real Kysely handle bound to the
 *    application role, so the RLS policy is what the assertions exercise.
 */
import type { Express } from 'express';
import { createApp, type AppDeps } from '../../src/app.ts';
import { fixedClock, type FixedClock } from '../../src/http/clock.ts';
import { createSilentLogger } from '../../src/http/logger.ts';
import { DevHeaderIdentityResolver } from '../../src/http/tenant.ts';
import type { Db } from '../../src/db/tenant-transaction.ts';

export const TEST_REQUEST_TIME = '2026-01-01T00:00:00.000Z';

/**
 * A `Db` that fails loudly if it is ever used. Passing it is how a test asserts
 * "this endpoint must not touch the database": if it does, the test fails with a
 * clear message instead of a connection error.
 */
export const throwingDb: Db = new Proxy({} as Db, {
  get(_target, property) {
    return () => {
      throw new Error(
        `The database was used in a test that must not use it (property "${String(property)}").`,
      );
    };
  },
});

export interface TestAppOptions {
  db?: Db;
  clock?: FixedClock;
  env?: NodeJS.ProcessEnv;
}

export interface TestApp {
  app: Express;
  clock: FixedClock;
}

export function buildTestApp(options: TestAppOptions = {}): TestApp {
  const clock = options.clock ?? fixedClock(TEST_REQUEST_TIME);
  const env = options.env ?? { NODE_ENV: 'test' };

  const deps: AppDeps = {
    db: options.db ?? throwingDb,
    clock,
    logger: createSilentLogger(),
    resolver: new DevHeaderIdentityResolver(env),
    version: '0.0.1-test',
    quietLogs: true,
  };

  return { app: createApp(deps).express, clock };
}

/** Tenant/user header pair for the development identity resolver. */
export function identityHeaders(tenantId: string, userId: string): Record<string, string> {
  return { 'x-tenant-id': tenantId, 'x-user-id': userId };
}
