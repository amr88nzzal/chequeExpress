import Decimal from 'decimal.js';
import type { FormatSettings } from '../config/settings';
import { fractionDigitsFor } from '../config/currencies';

/**
 * Formatting helpers. Everything is driven by `FormatSettings` — never by a
 * literal separator or a hand-written pattern (CONVENTIONS.md §16).
 */

function groupInteger(integer: string, separator: string): string {
  // Grouping is a pure string operation on purpose: `Intl.NumberFormat` would
  // require converting the decimal string to a `number` and losing precision.
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * `formatMoney('5.123', 'JOD', settings) -> "5.123 JOD"`,
 * `formatMoney('1234.5', 'USD', settings) -> "1,234.50 USD"`.
 */
export function formatMoney(amount: string, currency: string, settings: FormatSettings): string {
  const digits = fractionDigitsFor(currency);
  const fixed = new Decimal(amount).toFixed(digits, Decimal.ROUND_HALF_UP);
  const negative = fixed.startsWith('-');
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [integer, fraction] = unsigned.split('.');
  const grouped = groupInteger(integer, settings.groupSeparator);
  const body =
    digits > 0 && fraction ? `${grouped}${settings.decimalSeparator}${fraction}` : grouped;
  return `${negative ? '-' : ''}${body} ${currency}`;
}

/** Grouping separator and digit count, without a currency symbol suffix. */
export function formatAmount(amount: string, currency: string, settings: FormatSettings): string {
  const formatted = formatMoney(amount, currency, settings);
  const suffix = ` ${currency}`;
  return formatted.endsWith(suffix) ? formatted.slice(0, -suffix.length) : formatted;
}

/**
 * Date-only business values (`issue_date`, `due_date`) have no time and no
 * zone, so they are anchored at UTC midnight: formatting them with the local
 * zone would render `2026-10-05` as `2026-10-04` west of Greenwich.
 */
export function formatDate(isoDate: string, settings: FormatSettings): string {
  const formatter = new Intl.DateTimeFormat(settings.locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'gregory',
    numberingSystem: 'latn',
    timeZone: 'UTC',
  });
  return formatter.format(new Date(`${isoDate}T00:00:00.000Z`));
}

/** Instants (`created_at`, `printed_at`) are stored in UTC and shown in the company zone. */
export function formatInstant(isoInstant: string, settings: FormatSettings): string {
  const formatter = new Intl.DateTimeFormat(settings.locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    numberingSystem: 'latn',
    timeZone: settings.timeZone,
  });
  return formatter.format(new Date(isoInstant));
}

/** Stable, locale-aware collation for tables. */
export function compareStrings(left: string, right: string, settings: FormatSettings): number {
  return left.localeCompare(right, settings.locale, { sensitivity: 'base' });
}
