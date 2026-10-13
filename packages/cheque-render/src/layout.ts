/**
 * Field layout: turns a field's box plus its text into positioned glyph runs in
 * millimetres.
 *
 * Vertical rule: a line occupies `lineHeightMm` and the glyph sits on the
 * baseline at `lineTop + (lineHeightMm + fontPt) / 2`, so the line box is evenly
 * filled above and below the em square. `ascender`/`descender` are read for
 * documentation and future mark positioning; the baseline rule itself depends
 * only on the field box and the point size. This is the rule the independent
 * expectation table in the tests encodes.
 *
 * Horizontal rule: `left` puts the run's ink at the box's left edge, `right`
 * puts it at the right edge, `center` centres it. The shaped glyph list is
 * always in left-to-right visual order, so `xMm` grows monotonically.
 */
import { InvalidFieldError } from './errors.ts';
import { advanceOf, shapeText, type ShapedGlyph, type TextFont } from './text/shape.ts';
import type { ChequeData, Field } from './types.ts';

/** A glyph ready to be drawn, in millimetres from the page's top-left corner. */
export interface PlacedGlyph {
  /** Code point used to address the glyph through the font's `cmap`. */
  readonly codePoint: number;
  readonly fontPt: number;
  /** Left edge of the glyph's advance box, millimetres from the page left edge. */
  readonly xMm: number;
  /** Baseline, millimetres from the page TOP edge. */
  readonly yMm: number;
  /** Advance in millimetres. */
  readonly advanceMm: number;
  readonly fieldId: string;
}

export interface PlacedField {
  readonly field: Field;
  readonly lines: readonly string[];
  readonly glyphs: readonly PlacedGlyph[];
}

export interface ResolvedFontMetrics {
  readonly unitsPerEm: number;
  readonly ascenderUnits: number;
  readonly descenderUnits: number;
}

/**
 * Wraps `text` into at most `maxLines` lines by distributing the words as
 * evenly as possible.
 *
 * The rule is deliberately simple and documented as *pending owner approval*:
 * the real cheque's amount-in-words cell needs a rule confirmed against the
 * paper form (see README, "still required from the project owner").
 */
export function wrapText(text: string, maxLines: number): string[] {
  const words = text.split(' ').filter((word) => word.length > 0);
  if (words.length === 0) return [];
  if (maxLines <= 1) return [words.join(' ')];
  const lineCount = Math.min(maxLines, words.length);
  const perLine = Math.ceil(words.length / lineCount);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += perLine) {
    lines.push(words.slice(i, i + perLine).join(' '));
  }
  return lines.slice(0, maxLines);
}

/**
 * Fills the remaining space of a line with `completeLineWith` (the project's
 * anti-tampering rule). Approximate by design: the run of filler characters is
 * grown until one more no longer fits the field width.
 */
export function completeLine(
  line: string,
  filler: string,
  availableMm: number,
  measure: (text: string) => number,
): string {
  if (filler.length === 0 || availableMm <= 0) return line;
  const unit = measure(filler);
  if (unit <= 0) return line;
  const used = measure(line);
  const remaining = availableMm - used;
  if (remaining < unit) return line;
  const count = Math.floor(remaining / unit);
  return line + filler.repeat(count);
}

export interface LayoutFieldInput {
  readonly field: Field;
  readonly text: string;
  /** Absolute box on the page, millimetres, y from the top edge. */
  readonly box: { xMm: number; yMm: number; wMm: number; hMm: number };
  readonly font: TextFont;
  readonly metrics: ResolvedFontMetrics;
  /** Map from glyph id to the code point used to address it in the PDF. */
  readonly codePointForGlyph: (glyphId: number) => number | undefined;
}

/**
 * Millimetres per PDF point. A local constant, deliberately: every number in the
 * layout loop below is in millimetres, so a single conversion factor keeps the
 * units unambiguous.
 */
const MM_PER_PT = 25.4 / 72;

/** Size of one font unit in millimetres at `fontPt`. */
function unitToMm(units: number, unitsPerEm: number, fontPt: number): number {
  return (units / unitsPerEm) * fontPt * MM_PER_PT;
}

export function layoutField(input: LayoutFieldInput): PlacedField {
  const { field, box, font, metrics } = input;
  if (!Number.isFinite(field.wMm) || field.wMm <= 0) {
    throw new InvalidFieldError('field width must be a positive number of millimetres', field.id);
  }
  if (!Number.isFinite(field.fontPt) || field.fontPt <= 0) {
    throw new InvalidFieldError('field fontPt must be positive', field.id);
  }
  if (!Number.isFinite(field.lineHeightMm) || field.lineHeightMm <= 0) {
    throw new InvalidFieldError('field lineHeightMm must be positive', field.id);
  }

  const maxLines = field.maxLines ?? 1;
  const dir = field.dir ?? 'rtl';
  let lines = wrapText(input.text, maxLines);
  if (lines.length === 0) return { field, lines: [], glyphs: [] };

  const measure = (value: string): number => {
    const shaped = shapeText(value, font, dir);
    return unitToMm(advanceOf(shaped.glyphs), metrics.unitsPerEm, field.fontPt);
  };

  if (field.completeLineWith !== undefined && field.completeLineWith.length > 0) {
    const lastIndex = lines.length - 1;
    lines = lines.map((line, index) =>
      index === lastIndex ? completeLine(line, field.completeLineWith!, field.wMm, measure) : line,
    );
  }

  const glyphs: PlacedGlyph[] = [];

  lines.forEach((line, lineIndex) => {
    const shaped = shapeText(line, font, dir);
    const lineWidthMm = unitToMm(advanceOf(shaped.glyphs), metrics.unitsPerEm, field.fontPt);
    let penMm: number;
    if (field.align === 'left') penMm = 0;
    else if (field.align === 'right') penMm = field.wMm - lineWidthMm;
    else penMm = (field.wMm - lineWidthMm) / 2;
    const lineCentreMm = (field.lineHeightMm + field.fontPt * MM_PER_PT) / 2;
    const baselineMm = box.yMm + lineIndex * field.lineHeightMm + lineCentreMm;
    for (const glyph of shaped.glyphs) {
      const advanceMm = unitToMm(glyph.advanceUnits, metrics.unitsPerEm, field.fontPt);
      const codePoint = input.codePointForGlyph(glyph.glyphId);
      if (codePoint !== undefined) {
        glyphs.push({
          codePoint,
          fontPt: field.fontPt,
          xMm: box.xMm + penMm,
          yMm: baselineMm,
          advanceMm,
          fieldId: field.id,
        });
      }
      penMm += advanceMm;
    }
  });

  return { field, lines, glyphs };
}

/** Text for each field id, derived from the cheque data. */
export function fieldText(
  id: string,
  data: ChequeData,
  amount: { readonly dinar: string; readonly fils: string },
  amountFields: readonly string[],
): string | undefined {
  switch (id) {
    case 'date':
      return data.issueDate;
    case 'payee':
      return data.payee;
    case 'amountWordsLine1':
      return data.amountWordsLine1;
    case 'amountWordsLine2':
      return `${data.amountWordsLine2} ${data.closingPhrase}`.trim();
    case 'amountDinar':
      return amount.dinar;
    case 'amountFils':
      return amount.fils;
    case 'memo':
      return data.memo;
    default:
      return amountFields.includes(id) ? amount.dinar : undefined;
  }
}

export type { ShapedGlyph };
export { shapeText };
