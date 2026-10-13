/**
 * Arabic joining, applied before shaping.
 *
 * ## Why this exists (measured, not assumed)
 *
 * HarfBuzz selects its Arabic shaper from the scripts a font declares in its
 * layout tables. The `harfbuzzjs` build used here returns no scripts at all for
 * a hand-built `GSUB` -- an empty table, a table with only the `arab` script, and
 * a full table with the five joining features were each rejected, while a real
 * font's `GSUB` in the same font slot is recognised. With no `arab` script in
 * `GSUB`, this build routes the text through its default shaper and the letters
 * come out isolated.
 *
 * So joining is done here, in pure TypeScript, by mapping each letter to the
 * Arabic presentation form that its neighbours require -- and the fixture font
 * spells every one of those forms in its `cmap`. HarfBuzz then shapes the
 * resulting presentation forms (ordering, advances, and any `GSUB` a production
 * font provides on top).
 *
 * ## Scope
 *
 * The table below covers the letters of the Jordan/JOD target alphabet that the
 * package's tests use. Extending it is a data change, not a logic change: add the
 * letter's joining class and the form code points its font spells. The lam-alef
 * ligature is deliberately not formed; it is a presentation choice the production
 * font's own `GSUB` should own.
 */
import type { TextDir } from '../types.ts';

/** Unicode joining classes that affect how a letter connects. */
export type JoiningClass = 'dual' | 'right' | 'left' | 'none';

export interface JoiningLetter {
  /** The letter's base code point. */
  readonly codePoint: number;
  /** Whether the letter joins to the following letter, the preceding one, or both. */
  readonly joins: 'dual' | 'right';
  readonly forms: {
    readonly isolated: number;
    readonly initial?: number;
    readonly medial?: number;
    readonly final?: number;
  };
}

/**
 * The joining data. The code points are the Arabic Presentation Forms-B spellings
 * of each letter, which is what a font that carries no `GSUB` shaping data spells
 * in its `cmap`. The forms were verified against the fixture font's own `cmap`
 * (see `tools/build-test-font.ts`).
 */
export const JOINING_LETTERS: readonly JoiningLetter[] = [
  {
    codePoint: 0x0627, // ALEF: right-joining, so it only takes the final form.
    joins: 'right',
    forms: { isolated: 0xfe8d, final: 0xfe8e },
  },
  {
    codePoint: 0x062d, // HAH
    joins: 'dual',
    forms: { isolated: 0xfee7, initial: 0xfee7, medial: 0xfee0, final: 0xfee0 },
  },
  {
    codePoint: 0x0644, // LAM
    joins: 'dual',
    forms: { isolated: 0xfeed, initial: 0xfeef, final: 0xfeee },
  },
  {
    codePoint: 0x0645, // MEEM
    joins: 'dual',
    forms: { isolated: 0xfee1, initial: 0xfee3, medial: 0xfee4, final: 0xfee2 },
  },
  {
    codePoint: 0x0647, // HEH
    joins: 'dual',
    forms: { isolated: 0xfee9, initial: 0xfeeb, medial: 0xfeec, final: 0xfeea },
  },
];

const BY_CODE_POINT = new Map(JOINING_LETTERS.map((letter) => [letter.codePoint, letter]));

/** True when the code point is one of the letters in `JOINING_LETTERS`. */
export function isJoiningLetter(codePoint: number): boolean {
  return BY_CODE_POINT.has(codePoint);
}

/** Joining class of a code point, for callers that need to inspect the table. */
export function joiningClassOf(codePoint: number): JoiningClass {
  const letter = BY_CODE_POINT.get(codePoint);
  if (!letter) return 'none';
  return letter.joins;
}

/** Whether `previous` connects forward to the letter after it. */
function joinsForward(codePoint: number): boolean {
  return BY_CODE_POINT.get(codePoint)?.joins === 'dual';
}

/** Whether `next` connects backward to the letter before it. */
function joinsBackward(codePoint: number): boolean {
  return BY_CODE_POINT.has(codePoint);
}

/**
 * Joins the letters of `text` and returns the presentation-form string.
 *
 * Characters outside the table (digits, spaces, Latin, punctuation) are passed
 * through untouched, so mixed content keeps its structure for the bidi pass.
 *
 * Only right-to-left runs are joined: `dir` is the paragraph direction the
 * caller already resolved, and joining a string that will be reversed by the
 * bidi pass would connect the wrong neighbours.
 */
export function applyArabicJoining(text: string, dir: TextDir = 'rtl'): string {
  if (dir !== 'rtl') return text;
  const characters = [...text];
  const codePoints = characters.map((character) => character.codePointAt(0) ?? 0);
  const out: string[] = [];
  for (let index = 0; index < codePoints.length; index += 1) {
    const codePoint = codePoints[index]!;
    const letter = BY_CODE_POINT.get(codePoint);
    if (!letter) {
      out.push(characters[index]!);
      continue;
    }
    const connectsBack = index > 0 && joinsForward(codePoints[index - 1]!);
    const connectsForward = index + 1 < codePoints.length && joinsBackward(codePoints[index + 1]!);
    const ableToJoinForward = letter.joins === 'dual';
    let form = letter.forms.isolated;
    if (connectsBack && connectsForward && ableToJoinForward && letter.forms.medial !== undefined) {
      form = letter.forms.medial;
    } else if (connectsForward && ableToJoinForward && letter.forms.initial !== undefined) {
      form = letter.forms.initial;
    } else if (connectsBack && letter.forms.final !== undefined) {
      form = letter.forms.final;
    }
    out.push(String.fromCodePoint(form));
  }
  return out.join('');
}
