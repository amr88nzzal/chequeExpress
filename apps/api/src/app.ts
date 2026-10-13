/**
 * The Express application factory. Everything it needs (database, clock, logger,
 * identity resolver) is injected, so a test can build the real HTTP stack against
 * a real database or a stub without a module-mocking dance.
 *
 * Middleware order is part of the contract:
 *   1. requestId  — every later layer, including the error envelope, needs it;
 *   2. httpLogger — access line, needs requestId;
 *   3. express.json — bounded body parser;
 *   4. routes     — tenant middleware runs before the /api/v1 routers;
 *   5. notFound   — anything unmatched becomes the standard 404 envelope;
 *   6. errorHandler — the single sink, last.
 *
 * Importing this module must not open a database connection: `../db/pool.ts` is
 * lazily constructed, and this factory receives the handle it should use.
 */
import express, { type Express, type Router } from 'express';
import { errorHandler, notFoundHandler } from './http/error-handler.ts';
import { httpLoggerMiddleware } from './http/http-logger.ts';
import { requestIdMiddleware } from './http/request-id.ts';
import { tenantMiddleware, type IdentityResolver } from './http/tenant.ts';
import type { Clock } from './http/clock.ts';
import type { Logger } from './http/logger.ts';
import type { Db } from './db/tenant-transaction.ts';
import { createDemoItemRepository } from './demo/demo-items.repository.ts';
import { createDemoItemService } from './demo/demo-items.service.ts';
import { createDemoItemRouter } from './demo/demo-items.routes.ts';
import { createHealthRouter } from './health/health.routes.ts';

export interface AppDeps {
  db: Db;
  clock: Clock;
  logger: Logger;
  resolver: IdentityResolver;
  version?: string;
  /** Suppresses access logs in unit tests. */
  quietLogs?: boolean;
}

export interface App {
  express: Express;
  apiRouter: Router;
}

export function createApp(deps: AppDeps): App {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestIdMiddleware({ logger: deps.logger }));
  app.use(httpLoggerMiddleware({ logger: deps.logger, quiet: deps.quietLogs ?? false }));
  app.use(express.json({ limit: '1mb' }));

  // Health is intentionally outside the identity boundary: a monitor has no tenant.
  app.use('/health', createHealthRouter({ clock: deps.clock, version: deps.version ?? '0.0.1' }));

  const apiRouter = express.Router();
  apiRouter.use(tenantMiddleware({ resolver: deps.resolver, clock: deps.clock }));
  apiRouter.use(
    '/demo-items',
    createDemoItemRouter({
      service: createDemoItemService({
        db: deps.db,
        repository: createDemoItemRepository(),
        clock: deps.clock,
      }),
    }),
  );

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler());
  app.use(errorHandler({ logger: deps.logger }));

  return { express: app, apiRouter };
}
