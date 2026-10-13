/**
 * Error contract (docs/CONVENTIONS.md 13):
 *   { error: { code, message, details, requestId } }
 * Codes are a stable UPPER_SNAKE vocabulary; callers must never switch on the
 * human-readable `message`.
 *
 * Status-code mapping is fixed by the same section:
 *   400 validation · 401 identity · 403 permission · 404 not found OR out of scope
 *   409 conflict · 422 business rule
 */

export const ERROR_CODES = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE_VIOLATION: 422,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type AppErrorDetails = Record<string, unknown> | undefined;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: AppErrorDetails;

  constructor(code: ErrorCode, message: string, details?: AppErrorDetails) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }
}

export const badRequest = (message: string, details?: AppErrorDetails): AppError =>
  new AppError('VALIDATION_FAILED', message, details);

export const unauthenticated = (message = 'Authentication is required'): AppError =>
  new AppError('UNAUTHENTICATED', message);

export const forbidden = (message = 'The caller lacks the required permission'): AppError =>
  new AppError('FORBIDDEN', message);

/**
 * 404 covers both "does not exist" and "exists but outside the caller's scope"
 * (docs/CONVENTIONS.md 9). The two are deliberately indistinguishable so that a
 * tenant cannot probe for another tenant's identifiers.
 */
export const notFound = (message = 'Resource not found'): AppError =>
  new AppError('NOT_FOUND', message);

export const conflict = (message: string, details?: AppErrorDetails): AppError =>
  new AppError('CONFLICT', message, details);

export const businessRule = (message: string, details?: AppErrorDetails): AppError =>
  new AppError('BUSINESS_RULE_VIOLATION', message, details);

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Wire shape of a failure response body. */
export interface ErrorBody {
  error: {
    code: ErrorCode | 'INTERNAL_ERROR';
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

/** Wire shape of a success response body. */
export interface SuccessBody<TData, TMeta = Record<string, unknown> | undefined> {
  data: TData;
  meta: TMeta;
}
