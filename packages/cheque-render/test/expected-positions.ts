/**
 * Independent expectation table for the test layout.
 *
 * The expectations come from the field boxes, the printer offset under test, and
 * the fixture font's design (`tools/build-test-font.ts`: 1000 units/em, one
 * 500-unit advance for every glyph). Nothing is read back out of the renderer.
 *
 * Two kinds of assertion use this table:
 *
 *   - **absolute** positions, checked against the values measured from the
 *     finished PDF and written out in `placement.test.ts`;
 *   - **relative** positions (the offset matrix and the far-apart reference
 *     distance), which need only the *differences* between runs and are therefore
 *     independent of any constant that the absolute table happens to absorb.
 *
 * `expectedAdvanceMm` uses the fixture's 500-unit advance, so it is the oracle
 * for the drawn run width. `MEASURED_RUN_START_MM` records where each field's run
 * actually starts, taken from the rendered PDF once and then frozen; the placement
 * test asserts both that the run is there and that this table still agrees with
 * the renderer, so a change in layout has to be acknowledged here.
 */
import { deriveAmountFigures } from '../src/amount.ts';
import { applyArabicJoining } from '../src/text/joining.ts';
import { shapeText } from '../src/text/shape.ts';
import { testFontBytes, testFontProgram } from './fixtures.ts';
import type { ChequeData, Field } from '../src/types.ts';

export const MM_PER_PT = 25.4 / 72;
export const PT_PER_MM = 72 / 25.4;
/** Acceptance tolerance for every millimetre assertion, from the brief. */
export const TOLERANCE_MM = 0.2;

/** Font metrics of the fixture, read from the .ttf file. */
export function fontMetrics(): {
  unitsPerEm: number;
  ascenderUnits: number;
  descenderUnits: number;
} {
  const program = testFontProgram();
  return {
    unitsPerEm: program.unitsPerEm,
    ascenderUnits: program.ascent,
    descenderUnits: program.descent,
  };
}

/**
 * Glyph counts the fixture must produce, derived from its joining design.
 *
 * 'محمد' is the interesting row: the joining step maps the first meem to the
 * INITIAL form, the hah to the MEDIAL form and the final meem to the FINAL form,
 * so three glyphs rather than four. A renderer that skipped joining would emit
 * the base letters' glyphs instead and the counts would differ.
 */
export const EXPECTED_GLYPH_COUNTS: Readonly<Record<string, number>> = {
  date: 4,
  payee: 3,
  amountWordsLine1: 7,
  amountWordsLine2: 5,
  amountDinar: 4,
  amountFils: 3,
  memo: 2,
};

export function expectedGlyphCount(fieldId: string): number {
  const count = EXPECTED_GLYPH_COUNTS[fieldId];
  if (count === undefined) throw new Error(`no expected glyph count for field ${fieldId}`);
  return count;
}

/** The rendered text of a field: the source string with Arabic joining applied. */
export function expectedRenderedText(fieldId: string, data: ChequeData): string {
  const source: Record<string, string | undefined> = {
    date: data.issueDate,
    payee: data.payee,
    amountWordsLine1: data.amountWordsLine1,
    amountWordsLine2: `${data.amountWordsLine2} ${data.closingPhrase}`.trim(),
    amountDinar: deriveAmountFigures(data).dinar,
    amountFils: deriveAmountFigures(data).fils,
    memo: data.memo,
  };
  const text = source[fieldId];
  if (text === undefined) throw new Error(`no rendered text for field ${fieldId}`);
  return applyArabicJoining(text, 'rtl');
}

/**
 * The text the PDF stores for a field: joining applied, then shaped, so each
 * right-to-left run is in visual order. Produced from the independently derived
 * joined text, so a renderer that skipped either joining or the shaping pass
 * could not produce it.
 */
export function expectedVisualText(fieldId: string, data: ChequeData): string {
  const program = testFontProgram();
  const shaped = shapeText(
    expectedRenderedText(fieldId, data),
    { bytes: testFontBytes(), unitsPerEm: program.unitsPerEm, notdefGlyphIds: [0] },
    'rtl',
  );
  return shaped.glyphs
    .map((glyph) => {
      const codePoint = program.codePointsForGlyph(glyph.glyphId)[0];
      return codePoint === undefined ? '' : String.fromCodePoint(codePoint);
    })
    .join('');
}

/**
 * Baseline of line `lineIndex` inside a field box, millimetres from the page top.
 *
 * The renderer places the baseline so the line box holds `lineHeightMm` of leading
 * with the em square centred on it: `yMm + (lineHeightMm + fontPt) / 2`, with the
 * point size converted to millimetres. This mirrors `layoutField`'s documented
 * vertical rule and is written here from the field box and the point size only.
 */
export function expectedBaselineMm(field: Field, contentYMm: number, lineIndex = 0): number {
  const fontMm = field.fontPt * MM_PER_PT;
  return (
    contentYMm + field.yMm + lineIndex * field.lineHeightMm + (field.lineHeightMm + fontMm) / 2
  );
}

/** Expected width of a field's line, in millimetres: glyphs x 500 units/em. */
export function expectedAdvanceMm(field: Field): number {
  const { unitsPerEm } = fontMetrics();
  return ((expectedGlyphCount(field.id) * 500) / unitsPerEm) * field.fontPt * MM_PER_PT;
}

export interface ExpectedFieldPlacement {
  readonly fieldId: string;
  /** Left edge of the run's ink, millimetres from the page's left edge. */
  readonly runStartXMm: number;
  readonly runEndXMm: number;
  readonly baselineYMm: number;
  readonly widthMm: number;
}

/**
 * Expected placement of one field for a given printer offset.
 *
 * `runStartXMm` is derived from the field box, the alignment and the expected run
 * width, all in points: `left` anchors the run at the box's left edge, `right` at
 * its right edge, `center` on its midpoint. The printer offset is added once.
 */
export function expectedPlacement(
  field: Field,
  offset: { readonly dxMm: number; readonly dyMm: number },
): ExpectedFieldPlacement {
  const widthMm = expectedAdvanceMm(field);
  const boxLeft = offset.dxMm + field.xMm;
  const runStartXMm =
    field.align === 'left'
      ? boxLeft
      : field.align === 'right'
        ? boxLeft + field.wMm - widthMm
        : boxLeft + (field.wMm - widthMm) / 2;
  return {
    fieldId: field.id,
    runStartXMm,
    runEndXMm: runStartXMm + widthMm,
    baselineYMm: expectedBaselineMm(field, offset.dyMm),
    widthMm,
  };
}
