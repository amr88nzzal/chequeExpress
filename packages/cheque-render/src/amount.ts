/**
 * Derives the amount in figures from the amount in words.
 *
 * Project rule: a cheque's money is never a JavaScript number, and the figures
 * cell must not be an independent copy of the words. The words lines are the
 * single source; the figures are parsed out of them, so the PDF can never print
 * "ثلاثة آلاف ... 3355" for a different amount than the figures cell.
 */
import { InvalidAmountError } from './errors.ts';
import type { ChequeData } from './types.ts';

/** Matches a run of plain ASCII decimal digits. */
const DIGIT_RUN = /[0-9]+/g;

export interface AmountFigures {
  /** The exact strings printed in the dinar and fils cells. */
  readonly dinar: string;
  readonly fils: string;
  /** The two words lines the figures were parsed from. */
  readonly sourceLines: readonly [string, string];
  /** The digits joined, in the order they appear in the words. */
  readonly sourceText: string;
  /**
   * Index of each figure inside `sourceText`, so a test can prove that the
   * rendered figures really come from the source string.
   */
  readonly sourceIndexOf: { readonly dinar: number; readonly fils: number };
}

/**
 * Extracts the two decimal fields of the amount from the two words lines.
 *
 * The expected shape is the one the project already produces (DESIGN 6):
 * line 1 carries the dinar figure, line 2 carries the fils figure, e.g.
 * `'... خمسة وخمسون دينارا 3355'` and `'و 515 فلس فقط'`.
 */
export function deriveAmountFigures(data: ChequeData): AmountFigures {
  const lines: readonly [string, string] = [data.amountWordsLine1, data.amountWordsLine2];
  const sourceText = lines.join('\n');
  const matches: { value: string; index: number }[] = [];
  for (const match of sourceText.matchAll(DIGIT_RUN)) {
    if (match.index === undefined) continue;
    matches.push({ value: match[0], index: match.index });
  }
  if (matches.length !== 2) {
    throw new InvalidAmountError(
      `the amount in words must contain exactly two decimal fields (dinar and fils), found ${matches.length}`,
      'amountWords',
    );
  }
  const [dinar, fils] = matches as [
    { value: string; index: number },
    { value: string; index: number },
  ];
  if (!/^[0-9]+$/.test(dinar.value) || !/^[0-9]+$/.test(fils.value)) {
    throw new InvalidAmountError('the amount fields must be plain decimal digits', 'amountWords');
  }
  return {
    dinar: dinar.value,
    fils: fils.value,
    sourceLines: lines,
    sourceText,
    sourceIndexOf: { dinar: dinar.index, fils: fils.index },
  };
}

/** Validates a money string: plain decimal digits only, no separator or sign. */
export function assertDecimalDigits(value: string, subject: string): void {
  if (!/^[0-9]+$/.test(value)) {
    throw new InvalidAmountError(
      `expected a plain decimal string of digits, received ${JSON.stringify(value)}`,
      subject,
    );
  }
}
