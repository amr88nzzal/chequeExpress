/**
 * Demo route layer: HTTP shape and validation only
 * (docs/CONVENTIONS.md 7: route → service → repository).
 *
 * A route handler does three things and nothing else: validate with Zod, call the
 * service, and pick the success envelope. It never touches `ctx.tx`, never writes
 * SQL, and never decides a business rule — the 404 for a cross-tenant id is
 * produced by the service because that is a business statement, not an HTTP one.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler, formatZodIssues } from '../http/error-handler.ts';
import { sendCreated, sendData, sendNoContent } from '../http/envelope.ts';
import { badRequest } from '../http/errors.ts';
import type { RequestContext } from '../http/context.ts';
import {
  createDemoItemSchema,
  updateDemoItemSchema,
  type DemoItemService,
} from './demo-items.service.ts';

const uuidSchema = z.string().uuid();
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export interface DemoItemRoutesDeps {
  service: DemoItemService;
}

export function createDemoItemRouter(deps: DemoItemRoutesDeps): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = parseOrThrow(listQuerySchema, req.query);
      const items = await deps.service.list(requireContext(req), query.limit);
      sendData(res, req.requestId, items, { count: items.length, limit: query.limit });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseOrThrow(uuidSchema, req.params.id);
      const item = await deps.service.get(requireContext(req), id);
      sendData(res, req.requestId, item);
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const input = parseOrThrow(createDemoItemSchema, req.body);
      const item = await deps.service.create(requireContext(req), input);
      sendCreated(res, req.requestId, item);
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseOrThrow(uuidSchema, req.params.id);
      const input = parseOrThrow(updateDemoItemSchema, req.body);
      const item = await deps.service.update(requireContext(req), id, input);
      sendData(res, req.requestId, item);
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseOrThrow(uuidSchema, req.params.id);
      await deps.service.delete(requireContext(req), id);
      sendNoContent(res);
    }),
  );

  return router;
}

/**
 * Zod is the single validation boundary (docs/CONVENTIONS.md 13). A failure is a
 * 400 with the field paths in `details`, never a 500.
 */
function parseOrThrow<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Request validation failed', { issues: formatZodIssues(parsed.error) });
  }
  return parsed.data;
}

/**
 * The tenant middleware guarantees this; the assertion documents the contract and
 * turns a mis-mounted router into a 500 instead of a query with a missing tenant.
 */
function requireContext(req: Request): RequestContext {
  if (typeof req.tenantId !== 'string' || typeof req.userId !== 'string') {
    throw new Error('Tenant context is missing: the tenant middleware must run before this route');
  }
  return req.context;
}
