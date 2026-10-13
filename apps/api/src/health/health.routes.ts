/**
 * `/health` (docs/CONVENTIONS.md 18: a health endpoint for monitoring).
 *
 * It reports liveness only and deliberately does not touch the database: a
 * liveness probe that fails when PostgreSQL is briefly unavailable would cause a
 * restart loop. A readiness endpoint that checks the pool belongs with deployment
 * (C9).
 */
import { Router } from 'express';
import { sendData } from '../http/envelope.ts';
import type { Clock } from '../http/clock.ts';

export interface HealthRouteDeps {
  clock: Clock;
  version: string;
}

export function createHealthRouter(deps: HealthRouteDeps): Router {
  const router = Router();

  router.get('/', (req, res) => {
    sendData(res, req.requestId, {
      status: 'ok',
      service: 'cheques-api',
      version: deps.version,
      time: deps.clock.nowIso(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  return router;
}
