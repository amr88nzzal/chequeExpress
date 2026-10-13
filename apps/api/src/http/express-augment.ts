/**
 * Express request augmentation.
 *
 * `requestId`, `context`, `tenantId` and `userId` are all set by the requestId and
 * tenant middlewares before any route runs; `log` is the pino request logger.
 * `tenantId` is optional on the type because it is only known after identity
 * resolution, which is why `requireContext` re-checks it.
 *
 * This is a declaration-merging module: its only purpose is the `declare module`.
 */
import type { Logger } from 'pino';
import type { RequestContext } from './context.ts';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    context: RequestContext;
    tenantId?: string;
    userId?: string;
    log: Logger;
  }
}
