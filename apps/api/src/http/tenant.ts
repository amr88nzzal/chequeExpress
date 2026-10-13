/**
 * Identity resolution and the tenant middleware.
 *
 * Real identity (JWT, 2FA, rotating refresh) is C1 and is explicitly out of scope
 * for this slice. What is in scope — and what the isolation acceptance test needs
 * — is a *seam*: something that turns a request into
 * `{ tenantId, userId, scope }` so that everything downstream is written against
 * the real `RequestContext` and will not change when JWT arrives.
 *
 * The development resolver below reads:
 *   x-tenant-id   required, uuid
 *   x-user-id     required, uuid
 *   x-scope-company-ids / x-scope-bank-account-ids   optional, comma separated uuids
 *
 * It is ONLY mounted when `DevHeaderIdentityResolver` is passed in explicitly by
 * `createApp`, and it refuses to resolve anything when NODE_ENV=production, so it
 * cannot become an accidental authentication bypass in a deployed environment.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { unauthenticated } from './errors.ts';
import type { RequestContext, Scope } from './context.ts';
import type { Clock } from './clock.ts';

export interface ResolvedIdentity {
  tenantId: string;
  userId: string;
  permissions: readonly string[];
  scope: Scope;
}

export interface IdentityResolver {
  resolve(request: Request): Promise<ResolvedIdentity> | ResolvedIdentity;
}

export interface TenantMiddlewareOptions {
  resolver: IdentityResolver;
  clock: Clock;
}

export function tenantMiddleware(options: TenantMiddlewareOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(options.resolver.resolve(req))
      .then((identity) => {
        const context: RequestContext = {
          tenantId: identity.tenantId,
          userId: identity.userId,
          scope: identity.scope,
          permissions: identity.permissions,
          clock: options.clock,
          requestId: req.requestId,
        };
        req.context = context;
        req.tenantId = identity.tenantId;
        req.userId = identity.userId;
        // From here on, every log line for this request carries the tenant.
        req.log = req.log.child({ tenantId: identity.tenantId });
        next();
      })
      .catch(next);
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DevHeaderIdentityResolver implements IdentityResolver {
  private readonly env: NodeJS.ProcessEnv;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
  }

  resolve(request: Request): ResolvedIdentity {
    if (this.env['NODE_ENV'] === 'production') {
      throw unauthenticated(
        'Header identity is disabled in production; a real identity provider is required',
      );
    }

    const tenantId = readUuidHeader(request, 'x-tenant-id', true);
    const userId = readUuidHeader(request, 'x-user-id', true);

    return {
      tenantId,
      userId,
      // Permissions are stubbed until C1 ships the permission tables. An empty
      // list means "no permission granted", and the only routes mounted today do
      // not require any.
      permissions: [],
      scope: {
        companyIds: readUuidListHeader(request, 'x-scope-company-ids'),
        bankAccountIds: readUuidListHeader(request, 'x-scope-bank-account-ids'),
      },
    };
  }
}

function readUuidHeader(request: Request, name: string, required: true): string;
function readUuidHeader(request: Request, name: string, required: false): string | undefined;
function readUuidHeader(request: Request, name: string, required: boolean): string | undefined {
  const value = request.get(name);
  if (value === undefined || value === '') {
    if (required) {
      throw unauthenticated(`Missing identity header: ${name}`);
    }
    return undefined;
  }
  if (!UUID_PATTERN.test(value)) {
    throw unauthenticated(`Header ${name} must be a uuid`);
  }
  return value.toLowerCase();
}

function readUuidListHeader(request: Request, name: string): string[] {
  const value = request.get(name);
  if (value === undefined || value.trim() === '') {
    return [];
  }
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part !== '')
    .map((part) => {
      if (!UUID_PATTERN.test(part)) {
        throw unauthenticated(`Header ${name} must contain only uuids`);
      }
      return part;
    });
}
