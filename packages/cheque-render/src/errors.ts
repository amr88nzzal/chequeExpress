/**
 * Typed failures for `@cheques/cheque-render`.
 *
 * Every rejection the renderer can produce is one of these, so callers can
 * branch on `code` instead of matching messages.
 */
export type ChequeRenderErrorCode =
  | 'MISSING_FONT'
  | 'INVALID_AMOUNT'
  | 'INVALID_FIELD'
  | 'INVALID_LAYOUT'
  | 'INVALID_PROFILE'
  | 'SHAPING_FAILED';

export class ChequeRenderError extends Error {
  readonly code: ChequeRenderErrorCode;
  /** Field or data key the failure belongs to, when there is one. */
  readonly subject: string | undefined;

  constructor(code: ChequeRenderErrorCode, message: string, subject?: string) {
    super(subject === undefined ? message : `${message} (${subject})`);
    this.name = 'ChequeRenderError';
    this.code = code;
    this.subject = subject;
  }
}

export class MissingFontError extends ChequeRenderError {
  constructor(message = 'no Arabic font bytes were supplied') {
    super('MISSING_FONT', message);
    this.name = 'MissingFontError';
  }
}

export class InvalidAmountError extends ChequeRenderError {
  constructor(message: string, subject?: string) {
    super('INVALID_AMOUNT', message, subject);
    this.name = 'InvalidAmountError';
  }
}

export class InvalidFieldError extends ChequeRenderError {
  constructor(message: string, subject?: string) {
    super('INVALID_FIELD', message, subject);
    this.name = 'InvalidFieldError';
  }
}

export class InvalidLayoutError extends ChequeRenderError {
  constructor(message: string, subject?: string) {
    super('INVALID_LAYOUT', message, subject);
    this.name = 'InvalidLayoutError';
  }
}

export class InvalidProfileError extends ChequeRenderError {
  constructor(message: string, subject?: string) {
    super('INVALID_PROFILE', message, subject);
    this.name = 'InvalidProfileError';
  }
}

export class ShapingError extends ChequeRenderError {
  constructor(message: string, subject?: string) {
    super('SHAPING_FAILED', message, subject);
    this.name = 'ShapingError';
  }
}
