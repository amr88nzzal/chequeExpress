/**
 * Shared plumbing for the renderer tests: render through the public API, then
 * read the produced PDF back with the independent reader.
 */
import { renderCheque } from '../../src/index.ts';
import type { ChequeData, ChequeLayout, PrinterProfile } from '../../src/types.ts';
import {
  EXPECTED_GLYPH_COUNTS,
  expectedPlacement,
  expectedVisualText,
} from '../expected-positions.ts';
import { TEST_FONTS } from '../fixtures.ts';
import { PdfReader, type PdfTextRun } from './pdf-reader.ts';

export interface RenderedCase {
  readonly bytes: Uint8Array;
  readonly reader: PdfReader;
  readonly runs: readonly PdfTextRun[];
}

/**
 * Renders with `subset: false`.
 *
 * The tests need the PDF to carry the font's REAL glyph ids and a faithful
 * `/ToUnicode` map, which is what `subset: false` gives: the CID equals the glyph
 * id. Subsetting is exercised separately by the subset test; the production
 * default stays `true`.
 */
export async function renderCase(
  layout: ChequeLayout,
  profile: PrinterProfile,
  data: ChequeData,
  options: { readonly subset?: boolean } = {},
): Promise<RenderedCase> {
  const bytes = await renderCheque(layout, profile, data, {
    fonts: TEST_FONTS,
    subset: options.subset ?? false,
  });
  const reader = await PdfReader.load(bytes);
  return { bytes, reader, runs: reader.runsPt() };
}

export interface MeasuredRun {
  readonly fieldId: string;
  readonly run: PdfTextRun;
  /** Left edge of the run's ink box, millimetres from the page's left edge. */
  readonly startXMm: number;
  /** Baseline, millimetres from the page's TOP edge. */
  readonly baselineYMm: number;
  readonly widthMm: number;
  /** Text decoded from the PDF's own `/ToUnicode` map. */
  readonly decodedText: string;
}

export function mmFromPt(value: number): number {
  return (value * 25.4) / 72;
}

/**
 * Measures every drawn run and labels it with the field it belongs to.
 *
 * Assignment is greedy by distance between the run's actual start and the start
 * the field should have, so two fields whose boxes are near each other (the dinar
 * and fils cells) can never steal each other's run.
 */
export function measureRuns(
  rendered: RenderedCase,
  layout: ChequeLayout,
  data: ChequeData,
  offset: { readonly dxMm: number; readonly dyMm: number },
): MeasuredRun[] {
  const heightMm = rendered.reader.pageSizeMm().heightMm;
  const remaining = [...rendered.runs];
  const measured: MeasuredRun[] = [];
  void data;
  for (const field of layout.fields) {
    const expected = expectedPlacement(field, offset);
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((run, index) => {
      const startXMm = mmFromPt(run.xPt);
      const baselineYMm = heightMm - mmFromPt(run.yPt);
      const distance =
        Math.abs(startXMm - expected.runStartXMm) * 10 +
        Math.abs(baselineYMm - expected.baselineYMm);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    // 2 mm of slack absorbs the run's own width differences while still refusing
    // to match a run that belongs to a different box.
    if (bestIndex < 0 || bestDistance > 20) {
      throw new Error(
        `expected a run for field ${field.id} near x=${expected.runStartXMm.toFixed(2)}mm, found none (closest ${bestDistance.toFixed(2)})`,
      );
    }
    const run = remaining.splice(bestIndex, 1)[0]!;
    measured.push({
      fieldId: field.id,
      run,
      startXMm: mmFromPt(run.xPt),
      baselineYMm: heightMm - mmFromPt(run.yPt),
      widthMm: mmFromPt(rendered.reader.runAdvancePt(run)),
      decodedText: rendered.reader.decodeRun(run),
    });
  }
  return measured;
}

/** The decoded text of a field's run, for assertions about joining and order. */
export function decodedTextOf(
  rendered: RenderedCase,
  layout: ChequeLayout,
  data: ChequeData,
  offset: { readonly dxMm: number; readonly dyMm: number },
  fieldId: string,
): string {
  const measured = measureRuns(rendered, layout, data, offset).filter(
    (row) => row.fieldId === fieldId,
  );
  if (measured.length !== 1) throw new Error(`no measured run for field ${fieldId}`);
  return measured[0]!.decodedText;
}

/** The exact visual-order string each field is expected to draw. */
export function expectedFieldTexts(data: ChequeData): { fieldId: string; text: string }[] {
  return Object.keys(EXPECTED_GLYPH_COUNTS).map((fieldId) => ({
    fieldId,
    text: expectedVisualText(fieldId, data),
  }));
}

/** Every field id the renderer fills, with its expected glyph count. */
export const EXPECTED_FIELD_IDS: readonly string[] = Object.keys(EXPECTED_GLYPH_COUNTS);
