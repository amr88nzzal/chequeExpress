/**
 * The single error sink (terminal middleware). It converts anything thrown in the
 * stack into the project's error envelope:
 *
 *   { error: { code, message, details, requestId } }
 *
 * Rules encoded here (docs/CONVENTIONS.md 13 and 14):
 *  - an `AppError` keeps its code and status (400/401/403/404/409/422);
 *  - anything else becomes a 500 with a generic message — internal messages and
 *    stack traces never reach the client, they only reach the log;
 *  - validation failures raised by Zod at the edge are reported as 400 with the
 *    field paths in `details`, not as 500;
 *  - nothing in the log line can contain an account number or a secret, because
 *    only `requestId`, `method`, `url` and the error itself are logged.
 */
import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, badRequest, isAppError } from './errors.ts';
import type { Logger } from './logger.ts';

export interface ErrorHandlerOptions {
  logger: Logger;
}

export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(new AppError('NOT_FOUND', `No route matches ${req.method} ${req.path}`, undefined));
  };
}

export function errorHandler(options: ErrorHandlerOptions): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const requestId = typeof req.requestId === 'string' ? req.requestId : 'unknown';
    const log = typeof req.log === 'object' && req.log !== null ? req.log : options.logger;
    const appError = toAppError(error);

    if (appError.status >= 500) {
      log.error({ err: error, method: req.method, url: req.originalUrl }, 'unhandled error');
    } else {
      log.warn(
        { code: appError.code, method: req.method, url: req.originalUrl },
        'request rejected',
      );
    }

    res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details === undefined ? {} : { details: appError.details }),
        requestId,
      },
    });
  };
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    return badRequest('Request validation failed', { issues: formatZodIssues(error) });
  }

  return new AppError('INTERNAL_ERROR', 'An unexpected error occurred');
}

export function formatZodIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    // A top-level schema (a path parameter, or a body that must be an object) has
    // an empty path; "(root)" is what a client can act on.
    path: issue.path.length === 0 ? '(root)' : issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Wraps an async handler so a rejected promise reaches the error middleware.
 * Express 5 forwards rejections itself, but relying on that implicitly makes the
 * failure path invisible in review; this keeps it explicit.
 */
export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}
