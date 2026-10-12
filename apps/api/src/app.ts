import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { failure } from '@cheques/shared';
import { healthRouter, type ReadinessCheck } from './modules/system/index.ts';

export type AppOptions = { readiness?: ReadinessCheck };

export const createApp = (options: AppOptions = {}): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    req.requestId = req.header('x-request-id') ?? randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  });

  app.use('/health', healthRouter(options.readiness));

  app.use((req, res) => {
    res.status(404).json(failure('NOT_FOUND', 'Route not found', req.requestId));
  });

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    // Never leak internals; details go to logs (structured logging arrives in C1).
    console.error(JSON.stringify({ requestId: req.requestId, error: String(err) }));
    res.status(500).json(failure('INTERNAL_ERROR', 'Unexpected error', req.requestId));
  };
  app.use(onError);

  return app;
};
