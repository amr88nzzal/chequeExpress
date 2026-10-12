export type Gender = 'm' | 'f';

export type ArabicNoun = {
  singular: string;
  plural: string;
  gender: Gender;
  /** Override for the dual form (e.g. "ديناران"). Derived when omitted. */
  dual?: string;
  /** Override for the form used after 11..99 (e.g. "دينارا"). Derived when omitted. */
  accusative?: string;
};

export type EnglishNoun = { singular: string; plural: string };

export type CurrencyWords = {
  /** ISO 4217 code. */
  code: string;
  /** Digits of the minor unit (JOD 3, USD 2). */
  minorDigits: number;
  ar: { main: ArabicNoun; fraction: ArabicNoun };
  en: { main: EnglishNoun; fraction: EnglishNoun };
};

/**
 * Seed profiles. They are data: adding a currency means adding an entry,
 * never changing the algorithm.
 */
export const JOD: CurrencyWords = {
  code: 'JOD',
  minorDigits: 3,
  ar: {
    main: { singular: 'دينار', plural: 'دنانير', gender: 'm' },
    fraction: { singular: 'فلس', plural: 'فلس', gender: 'm' },
  },
  en: {
    main: { singular: 'dinar', plural: 'dinars' },
    fraction: { singular: 'fils', plural: 'fils' },
  },
};

export const USD: CurrencyWords = {
  code: 'USD',
  minorDigits: 2,
  ar: {
    main: { singular: 'دولار', plural: 'دولارات', gender: 'm' },
    fraction: { singular: 'سنت', plural: 'سنتات', gender: 'm' },
  },
  en: {
    main: { singular: 'dollar', plural: 'dollars' },
    fraction: { singular: 'cent', plural: 'cents' },
  },
};

export const CURRENCIES: Record<string, CurrencyWords> = { JOD, USD };
