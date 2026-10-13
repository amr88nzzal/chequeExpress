import { toWesternDigits } from '../../../lib/digits';

/**
 * CONVENTIONS.md §11: before a print job is sent, the operator must type the last
 * digits of the cheque that is *actually loaded in the printer*. The check is
 * pure, so it is unit-testable, and the server repeats it — the client copy only
 * saves a round trip and can never be the authority.
 */
export const CONFIRMATION_DIGITS = 4;

export const PRINT_CONFIRM_ISSUES = [
  'PRINT_CONFIRM_REQUIRED',
  'PRINT_CONFIRM_LENGTH',
  'PRINT_CONFIRM_MISMATCH',
] as const;

export type PrintConfirmIssue = (typeof PRINT_CONFIRM_ISSUES)[number];

export type PrintConfirmResult = { ok: true } | { ok: false; issue: PrintConfirmIssue };

export const PRINT_CONFIRM_ERROR_KEYS: Readonly<Record<PrintConfirmIssue, string>> = {
  PRINT_CONFIRM_REQUIRED: 'print.confirm.errors.required',
  PRINT_CONFIRM_LENGTH: 'print.confirm.errors.length',
  PRINT_CONFIRM_MISMATCH: 'print.confirm.errors.mismatch',
};

/** Digits only, so `000123/45` and `٠٠٠١٢٣` both reduce to `00012345`. */
export function digitsOnly(value: string): string {
  return toWesternDigits(value).replace(/\D/g, '');
}

/** The last `digits` characters of the reserved cheque number. */
export function chequeNumberSuffix(
  chequeNumber: string,
  digits: number = CONFIRMATION_DIGITS,
): string {
  return digitsOnly(chequeNumber).slice(-digits);
}

export function validateLoadedSuffix(
  input: string,
  expectedChequeNumber: string,
  digits: number = CONFIRMATION_DIGITS,
): PrintConfirmResult {
  const expected = chequeNumberSuffix(expectedChequeNumber, digits);
  const typed = toWesternDigits(input).trim();

  if (typed.length === 0) return { ok: false, issue: 'PRINT_CONFIRM_REQUIRED' };

  const normalized = digitsOnly(typed);
  if (normalized.length !== expected.length) return { ok: false, issue: 'PRINT_CONFIRM_LENGTH' };
  if (normalized !== expected) return { ok: false, issue: 'PRINT_CONFIRM_MISMATCH' };
  return { ok: true };
}

export function printConfirmErrorKey(issue: PrintConfirmIssue): string {
  return PRINT_CONFIRM_ERROR_KEYS[issue];
}
