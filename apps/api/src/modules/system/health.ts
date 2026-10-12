import { Router } from 'express';
import { failure, success } from '@cheques/shared';

/** Resolves when dependencies (database, queue) are reachable; rejects otherwise. */
export type ReadinessCheck = () => Promise<void>;

export const healthRouter = (readiness: ReadinessCheck = async () => {}): Router => {
  const router = Router();

  // Liveness: the process is up. No dependency checks, so orchestrators never restart on DB blips.
  router.get('/live', (req, res) => {
    res.json(success({ status: 'live' }, req.requestId));
  });

  // Readiness: safe to receive traffic.
  router.get('/ready', async (req, res) => {
    try {
      await readiness();
      res.json(success({ status: 'ready' }, req.requestId));
    } catch {
      res.status(503).json(failure('NOT_READY', 'Dependencies unavailable', req.requestId));
    }
  });

  return router;
};
