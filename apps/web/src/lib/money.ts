import Decimal from 'decimal.js';
import { fractionDigitsFor } from '../config/currencies';
import { toWesternDigits } from './digits';

/**
 * Money never becomes a JavaScript `number` in this app (CONVENTIONS.md §6):
 * amounts are decimal *strings* on the wire and `Decimal` in the only place
 * where arithmetic happens.
 */
export type MoneyIssue =
  'AMOUNT_REQUIRED' | 'AMOUNT_FORMAT' | 'AMOUNT_FRACTION_DIGITS' | 'AMOUNT_NOT_POSITIVE';

export interface MoneyIssueDetail {
  ok: false;
  issue: MoneyIssue;
  currency: string;
  expectedFractionDigits: number;
}

export type MoneyCheck = { ok: true; value: string } | MoneyIssueDetail;

/** Digits, at most one decimal point, optional sign. No grouping, no exponent. */
const DECIMAL_STRING = /^[+-]?\d+(?:\.\d+)?$/;

export function normalizeAmountInput(input: string): string {
  return toWesternDigits(input).trim();
}

export function isDecimalString(input: string): boolean {
  return DECIMAL_STRING.test(normalizeAmountInput(input));
}

export function countFractionDigits(input: string): number {
  const normalized = normalizeAmountInput(input);
  const dot = normalized.indexOf('.');
  return dot === -1 ? 0 : normalized.length - dot - 1;
}

/**
 * Validates a typed amount for a given currency and returns the canonical
 * decimal string (padded to the currency's fraction digits) that the API
 * accepts, e.g. `"5.1"` + JOD -> `"5.100"`.
 */
export function validateMoney(input: string, currency: string): MoneyCheck {
  const expectedFractionDigits = fractionDigitsFor(currency);
  const value = normalizeAmountInput(input);

  if (value.length === 0) {
    return { ok: false, issue: 'AMOUNT_REQUIRED', currency, expectedFractionDigits };
  }
  if (!DECIMAL_STRING.test(value)) {
    return { ok: false, issue: 'AMOUNT_FORMAT', currency, expectedFractionDigits };
  }
  if (countFractionDigits(value) > expectedFractionDigits) {
    return { ok: false, issue: 'AMOUNT_FRACTION_DIGITS', currency, expectedFractionDigits };
  }
  const amount = new Decimal(value);
  if (!amount.gt(0)) {
    return { ok: false, issue: 'AMOUNT_NOT_POSITIVE', currency, expectedFractionDigits };
  }
  return { ok: true, value: amount.toFixed(expectedFractionDigits, Decimal.ROUND_HALF_UP) };
}
