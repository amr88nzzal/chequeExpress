/**
 * requestId middleware: every request gets a UUIDv7 id, echoed in the
 * `x-request-id` response header, attached to `req.requestId`, bound to the
 * per-request logger, and copied into every error envelope. An inbound
 * `x-request-id` from a trusted proxy is preserved so that a trace survives
 * across hops; it is validated first so a client cannot inject a log field.
 *
 * The logger child carries the id, which is how "every log line has requestId"
 * is guaranteed rather than remembered.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { uuidv7 } from './ids.ts';
import type { Logger } from './logger.ts';

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]+$/;

export interface RequestIdOptions {
  logger: Logger;
  headerName?: string;
}

export function requestIdMiddleware(options: RequestIdOptions): RequestHandler {
  const headerName = options.headerName ?? 'x-request-id';

  return (req: Request, res: Response, next: NextFunction): void => {
    const inbound = req.get(headerName);
    const requestId =
      inbound !== undefined && isSafeRequestId(inbound) ? inbound : uuidv7(Date.now());

    req.requestId = requestId;
    req.log = options.logger.child({ requestId });
    res.setHeader(headerName, requestId);
    next();
  };
}

function isSafeRequestId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_REQUEST_ID_LENGTH && SAFE_REQUEST_ID.test(value);
}
