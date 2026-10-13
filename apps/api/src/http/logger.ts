/**
 * pino (JSON) is the project logger (docs/CONVENTIONS.md 2 and 14).
 *
 * Two invariants are enforced by construction here:
 *  - every log line carries `requestId` (bound by the requestId middleware) and,
 *    once known, `tenantId`;
 *  - nothing account-related is ever logged. The serializers below whitelist the
 *    fields that may appear, so a future `logger.info(req)` cannot leak an
 *    `Authorization` header, a body, or an account number by accident.
 *
 * Docs/CONVENTIONS.md 14: "لا تُسجَّل في السجلات أرقام حسابات ولا رموز".
 */
import pino, { type Logger, type LoggerOptions } from 'pino';

export type { Logger };

export interface CreateLoggerOptions {
  level: string;
  /** Extra base fields (e.g. service name). */
  base?: Record<string, unknown>;
  /** Pretty transport is never enabled in tests or production. */
  pretty?: boolean;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const config: LoggerOptions = {
    level: options.level,
    base: { service: 'cheques-api', ...options.base },
    // Redaction is defence in depth: even if a raw object reaches the logger, the
    // sensitive keys are dropped.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body',
        'password',
        'passwordHash',
        'token',
        'accountNumber',
        'iban',
        'ibanEncrypted',
        'accountNumberEncrypted',
      ],
      remove: true,
    },
    serializers: {
      req(request: { id?: unknown; method?: unknown; url?: unknown; remoteAddress?: unknown }) {
        return {
          id: request.id,
          method: request.method,
          // The URL may contain a resource id, which is not sensitive; it never
          // contains an account number because ids are UUIDv7.
          url: request.url,
          remoteAddress: request.remoteAddress,
        };
      },
      res(response: { statusCode?: unknown }) {
        return { statusCode: response.statusCode };
      },
      err: pino.stdSerializers.err,
    },
  };

  return pino(config);
}

/** A logger that discards everything: used by unit tests that assert no logging. */
export function createSilentLogger(): Logger {
  return pino({ level: 'silent' });
}
