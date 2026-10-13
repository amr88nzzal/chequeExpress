/**
 * Type-level regression test for the Express augmentation.
 *
 * `src/http/express-augment.ts` is a declaration-merging module. Nothing imports it
 * for its runtime value (it has none), so without this file a rename of
 * `req.requestId` would compile everywhere and fail only at runtime. The
 * assignments below stop compiling the moment the augmentation or the field names
 * drift.
 *
 * The `expectTypeOf` calls run as no-ops at runtime; the value of this file is in
 * `tsc`.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { Request } from 'express';
import type { Logger } from 'pino';
import type { RequestContext } from '../src/http/context.ts';
import '../src/http/express-augment.ts';

describe('Express request augmentation', () => {
  it('declares requestId, context, tenantId, userId and log', () => {
    expectTypeOf<Request['requestId']>().toEqualTypeOf<string>();
    expectTypeOf<Request['context']>().toEqualTypeOf<RequestContext>();
    expectTypeOf<Request['log']>().toEqualTypeOf<Logger>();
    expectTypeOf<Request['tenantId']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Request['userId']>().toEqualTypeOf<string | undefined>();
  });

  it('accepts an assignment in the shapes the middlewares make', () => {
    const write = (req: Request): void => {
      req.requestId = '01890000-0000-7000-8000-000000000001';
      req.tenantId = '01890000-0000-7000-8000-000000000002';
      req.userId = '01890000-0000-7000-8000-000000000003';
      req.log = req.log.child({ tenantId: req.tenantId });
      req.context = {
        tenantId: req.tenantId,
        userId: req.userId,
        scope: { companyIds: [], bankAccountIds: [] },
        permissions: [],
        clock: { now: () => new Date(), nowIso: () => new Date().toISOString() },
        requestId: req.requestId,
      };
    };

    expectTypeOf(write).toBeFunction();
  });

  it('keeps tenantId optional so the identity middleware can fail before setting it', () => {
    const read = (req: Request): string | undefined => req.tenantId;
    expectTypeOf(read).returns.toEqualTypeOf<string | undefined>();
  });
});
