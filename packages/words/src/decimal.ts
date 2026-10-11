import { WordsError } from './errors.ts';

export const MAX_INTEGER_DIGITS = 18;

export type ParsedAmount = {
  /** Whole part (main currency unit). */
  integer: bigint;
  /** Fraction as an integer in minor units, e.g. "3355.515" with 3 digits -> 515n. */
  fraction: bigint;
  /** Number of minor-unit digits used to interpret `fraction`. */
  minorDigits: number;
};

/**
 * Parses a plain decimal string without ever touching floating point.
 * Strict by design: no sign, no exponent, no thousands separators, and never
 * rounds silently. More fractional digits than the currency allows is an error
 * unless the extra digits are zeros.
 */
export const parseAmount = (input: string, minorDigits: number): ParsedAmount => {
  if (typeof input !== 'string' || !/^\d+(\.\d+)?$/.test(input.trim())) {
    throw new WordsError(
      'INVALID_AMOUNT',
      `Amount must be a plain non-negative decimal string: "${input}"`,
    );
  }
  const [intRaw, fracRaw = ''] = input.trim().split('.');

  const intDigits = intRaw.replace(/^0+(?=\d)/, '');
  if (intDigits.length > MAX_INTEGER_DIGITS) {
    throw new WordsError('AMOUNT_TOO_LARGE', `Integer part exceeds ${MAX_INTEGER_DIGITS} digits`);
  }

  const frac = fracRaw.length > minorDigits ? fracRaw.replace(/0+$/, '') : fracRaw;
  if (frac.length > minorDigits) {
    throw new WordsError(
      'TOO_MANY_DECIMALS',
      `Currency allows ${minorDigits} decimal digits, got "${fracRaw}"`,
    );
  }

  const padded = frac.padEnd(minorDigits, '0');
  return {
    integer: BigInt(intDigits),
    fraction: minorDigits === 0 ? 0n : BigInt(padded),
    minorDigits,
  };
};
