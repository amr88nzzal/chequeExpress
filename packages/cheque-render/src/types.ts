/**
 * Public data model of `@cheques/cheque-render`.
 *
 * Coordinates are millimetres and `yMm` is measured from the TOP edge of the
 * page, matching the project's original Python spike (`spikes/pdf-print-python`).
 * Conversion to PDF's bottom-left origin happens once, in `writer.ts`.
 */

export type FieldAlign = 'left' | 'right' | 'center';
export type TextDir = 'rtl' | 'ltr';

/** One printable cell of a bank cheque layout. */
export interface Field {
  readonly id: string;
  /** Left edge, millimetres from the page's left edge. */
  readonly xMm: number;
  /** Top edge, millimetres from the page's TOP edge. */
  readonly yMm: number;
  readonly wMm: number;
  readonly hMm: number;
  /** Horizontal placement of the text inside the box. */
  readonly align: FieldAlign;
  readonly fontPt: number;
  /** Distance between consecutive line baselines. */
  readonly lineHeightMm: number;
  /** Maximum number of lines; extra lines are dropped. */
  readonly maxLines?: number;
  /** Paragraph direction. Defaults to `'rtl'`. */
  readonly dir?: TextDir;
  /**
   * Character used to fill the rest of the LAST line (the project's
   * anti-tampering rule, DESIGN 5.1). Never applied to the `amountFigures`
   * fields.
   */
  readonly completeLineWith?: string;
}

export interface ChequeLayout {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly fields: readonly Field[];
}

export type PaperMode = 'custom' | 'a4';

/** A4 is fixed; the cheque is placed inside it at `originXMm`/`originYMm`. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export interface PrinterProfile {
  /** Horizontal printer offset in millimetres. Positive moves content right. */
  readonly dxMm: number;
  /** Vertical printer offset in millimetres. Positive moves content DOWN. */
  readonly dyMm: number;
  /** Explicit scale. Omitted or 1 means "no scaling". */
  readonly scale?: number;
  readonly paperMode: PaperMode;
  /** `a4` only: where the cheque's top-left corner sits on the A4 sheet. */
  readonly originXMm?: number;
  readonly originYMm?: number;
  /** `a4` only: reserved for the printer's feed direction. */
  readonly feedOrientation?: 'portrait' | 'landscape';
}

/**
 * The printable values.
 *
 * Money is always a STRING of decimal digits (project rule: never a JS number).
 * The amount in figures is *not* a separate input: it is parsed out of the
 * amount-in-words lines, so the two can never disagree. See `amount.ts`.
 */
export interface ChequeData {
  readonly issueDate: string;
  readonly payee: string;
  /** First line of the amount in words, including the dinar figure. */
  readonly amountWordsLine1: string;
  /** Second line of the amount in words, including the fils figure. */
  readonly amountWordsLine2: string;
  readonly memo?: string;
  /** Per-bank closing phrase, appended to the last words line. */
  readonly closingPhrase: string;
}

export interface ArabicFontInput {
  readonly arabic: Uint8Array;
  /** SPDX id or short name of the font's licence; recorded in the PDF metadata. */
  readonly license?: string;
  /** Human readable font name for the metadata and diagnostics. */
  readonly name?: string;
}

export interface RenderOptions {
  /**
   * Font bytes for the Arabic face. Required: this package never downloads a
   * font and never ships a production face (see the README).
   */
  readonly fonts: ArabicFontInput;
  /** Embed only the glyphs actually used. Defaults to `true`. */
  readonly subset?: boolean;
  /** PDF metadata title. */
  readonly title?: string;
  /**
   * PDF creation/modification date. Defaults to the PDF epoch (`Date(0)`) so a
   * render is byte-for-byte reproducible; pass the real time from the caller's
   * clock if the document needs it.
   */
  readonly createdAt?: Date;
}
