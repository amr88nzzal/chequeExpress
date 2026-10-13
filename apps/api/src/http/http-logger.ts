/**
 * HTTP access logging with pino-http (docs/CONVENTIONS.md 2: pino JSON with
 * `requestId` and `tenantId`).
 *
 * The access line is deliberately narrow: id, method, url, status, duration. The
 * serializers in `logger.ts` whitelist fields, and pino-http by default does not
 * log headers or bodies, so an account number, an IBAN or an Authorization header
 * cannot reach a log line through this path (docs/CONVENTIONS.md 14).
 *
 * `quiet` exists for unit tests: the route tests assert behaviour, not log noise.
 */
import { pinoHttp } from 'pino-http';
import type { Request, RequestHandler } from 'express';
import type { Logger } from './logger.ts';

export interface HttpLoggerOptions {
  logger: Logger;
  quiet?: boolean;
}

export function httpLoggerMiddleware(options: HttpLoggerOptions): RequestHandler {
  return pinoHttp({
    logger: options.logger,
    quietReqLogger: options.quiet ?? false,
    // `requestId` and `tenantId` are set by the requestId and tenant middlewares.
    // pino-http types the request as a bare `IncomingMessage`, hence the cast to
    // the augmented Express `Request`.
    customProps: (message) => {
      const req = message as unknown as Request;
      return {
        requestId: req.requestId,
        ...(req.tenantId === undefined ? {} : { tenantId: req.tenantId }),
      };
    },
    customSuccessMessage: (req, res) => `${req.method ?? 'GET'} ${req.url ?? ''} ${res.statusCode}`,
    // One line per request: 4xx/5xx are already reported by the error handler with
    // the error code, so this only needs the right level.
    customLogLevel: (_req, res, error) => {
      if (error !== undefined || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  }) as unknown as RequestHandler;
}
