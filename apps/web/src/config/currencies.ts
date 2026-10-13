/**
 * Currency metadata. In the real system this table is the `currencies` table
 * (ISO 4217 code + minor unit) served by `apps/api`; the UI must never invent
 * fraction digits on its own (CONVENTIONS.md §6).
 *
 * `SUPPORTED_CURRENCIES` is the source of truth and `CURRENCY_FRACTION_DIGITS`
 * is typed as `Record<Currency, number>`, so adding a currency without its
 * minor unit is a compile error.
 */
export const SUPPORTED_CURRENCIES = [
  'JOD',
  'USD',
  'EUR',
  'GBP',
  'ILS',
  'SAR',
  'AED',
  'EGP',
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_FRACTION_DIGITS: Readonly<Record<Currency, number>> = {
  JOD: 3,
  USD: 2,
  EUR: 2,
  GBP: 2,
  ILS: 2,
  SAR: 2,
  AED: 2,
  EGP: 2,
};

export const FALLBACK_FRACTION_DIGITS = 2;

export const DEFAULT_CURRENCY: Currency = 'JOD';

export function isSupportedCurrency(value: string): value is Currency {
  return SUPPORTED_CURRENCIES.some((code) => code === value);
}

export function fractionDigitsFor(currency: string): number {
  return isSupportedCurrency(currency)
    ? CURRENCY_FRACTION_DIGITS[currency]
    : FALLBACK_FRACTION_DIGITS;
}
