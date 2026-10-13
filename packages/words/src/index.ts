import { countWithNoun } from './ar.ts';
import { countWithNounEn } from './en.ts';
import type { ArabicNoun, CurrencyWords } from './currencies.ts';
import { parseAmount } from './decimal.ts';

export { WordsError } from './errors.ts';
export type { WordsErrorCode } from './errors.ts';
export { CURRENCIES, JOD, USD } from './currencies.ts';
export type { ArabicNoun, CurrencyWords, EnglishNoun, Gender } from './currencies.ts';
export { parseAmount } from './decimal.ts';

export type Lang = 'ar' | 'en';

/** Noun after a digit-written fraction: plural for 3..10 (5 سنتات), singular otherwise. */
const numericFractionNounAr = (fraction: bigint, noun: ArabicNoun): string => {
  const tail = Number(fraction % 100n);
  return tail >= 3 && tail <= 10 ? noun.plural : noun.singular;
};

/**
 * numeric: "... و 515 فلس"          (the style the current Excel sheet uses)
 * words:   "... وخمسمائة وخمسة عشر فلسا"
 */
export type FractionStyle = 'numeric' | 'words';

export type AmountWordsOptions = {
  /** Plain decimal string, never a JS number: "3355.515". */
  amount: string;
  currency: CurrencyWords;
  lang: Lang;
  fractionStyle?: FractionStyle;
  /**
   * Append the closing word ("فقط" / prefix "Only"). Defaults to false: per
   * DESIGN.md §6 the closing phrase is not part of the tafqeet output, it is
   * appended by the per-bank print template.
   */
  closing?: boolean;
};

export const amountToWords = ({
  amount,
  currency,
  lang,
  fractionStyle = 'numeric',
  closing = false,
}: AmountWordsOptions): string => {
  const { integer, fraction } = parseAmount(amount, currency.minorDigits);
  const hasFraction = fraction > 0n;

  if (lang === 'ar') {
    const { main, fraction: fracNoun } = currency.ar;
    const mainPart = integer === 0n && hasFraction ? '' : countWithNoun(integer, main);
    let fracPart = '';
    if (hasFraction) {
      fracPart =
        fractionStyle === 'numeric'
          ? `${fraction.toString()} ${numericFractionNounAr(fraction, fracNoun)}`
          : countWithNoun(fraction, fracNoun);
    }
    let text = mainPart;
    if (fracPart) {
      if (!mainPart) text = fracPart;
      else
        text =
          fractionStyle === 'numeric' ? `${mainPart} و ${fracPart}` : `${mainPart} و${fracPart}`;
    }
    return closing ? `${text} فقط` : text;
  }

  const { main, fraction: fracNoun } = currency.en;
  const mainPart = integer === 0n && hasFraction ? '' : countWithNounEn(integer, main);
  let fracPart = '';
  if (hasFraction) {
    fracPart =
      fractionStyle === 'numeric'
        ? `${fraction.toString()} ${fraction === 1n ? fracNoun.singular : fracNoun.plural}`
        : countWithNounEn(fraction, fracNoun);
  }
  const text = [mainPart, fracPart].filter(Boolean).join(' and ');
  return closing ? `Only ${text}` : text;
};
