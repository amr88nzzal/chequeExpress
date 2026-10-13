/**
 * The only module that draws. It takes already-positioned glyphs in millimetres
 * (y from the top edge), flips them once into PDF's bottom-left origin, and
 * clips anything that the printer offset pushed past the page edge.
 *
 * Clipping matters here: the page's `/MediaBox` is written from
 * `geometry.pageWidthMm`/`pageHeightMm` and never from the content, so no amount
 * of overflowing content can change the page size.
 *
 * Positioning is explicit. pdf-lib's `drawText` encodes through the font's
 * `cmap`, and this package's font adapter answers that with a one-to-one
 * code-point-to-glyph mapping, so a single `Tj` per line carries exactly the
 * glyphs HarfBuzz produced and pdf-lib never re-shapes or reorders them. The
 * *starting* pen position of each line is set by `drawText`; the advances inside
 * the line come from the embedded font's widths.
 */
import {
  clip,
  closePath,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFOperator,
  type PDFPage,
} from 'pdf-lib';
import type { PageGeometry } from '../geometry.ts';
import type { PlacedGlyph } from '../layout.ts';
import { mmToPt } from '../units.ts';
import type { PdfFontHandle } from './fonts.ts';

/** Tolerance below which a glyph does not get its own clip path, in points. */
const CLIP_EPSILON_PT = 1e-6;

/** Axis-aligned ink bounds in millimetres, `y` from the page's top edge. */
export interface InkBoundsMm {
  readonly minXMm: number;
  readonly minYMm: number;
  readonly maxXMm: number;
  readonly maxYMm: number;
}

export interface DrawnLine {
  readonly fieldId: string;
  /** Text drawn, one code point per glyph. */
  readonly text: string;
  readonly glyphCount: number;
  /** Origin of the line's first glyph, in millimetres from the top-left corner. */
  readonly startXMm: number;
  readonly baselineYMm: number;
}

export interface DrawResult {
  readonly lines: readonly DrawnLine[];
  /** Bounding box of everything drawn, millimetres, y from the top edge. */
  readonly inkBoundsMm: InkBoundsMm | undefined;
  readonly drawnGlyphs: number;
  /** Glyphs dropped because they sat entirely outside the page. */
  readonly clippedGlyphs: number;
}

export interface DrawInput {
  readonly page: PDFPage;
  readonly geometry: PageGeometry;
  readonly font: PdfFontHandle;
  readonly glyphs: readonly PlacedGlyph[];
  /** Field ids in the order they should appear in the content stream. */
  readonly fieldOrder: readonly string[];
}

function rectPath(left: number, bottom: number, right: number, top: number): PDFOperator[] {
  return [
    moveTo(left, bottom),
    lineTo(right, bottom),
    lineTo(right, top),
    lineTo(left, top),
    closePath(),
    clip(),
    endPath(),
  ];
}

/**
 * Groups consecutive glyphs into one text run.
 *
 * The grouping key is `(fieldId, baseline)`: two fields that happen to share a
 * baseline (the dinar and fils cells sit side by side on one line) must stay
 * separate runs, otherwise the fields can no longer be told apart in the PDF and
 * the producer of the text loses the field boundary.
 */
function groupLines(sorted: readonly PlacedGlyph[]): PlacedGlyph[][] {
  const lines: PlacedGlyph[][] = [];
  let current: PlacedGlyph[] = [];
  for (const glyph of sorted) {
    const previous = current[current.length - 1];
    if (
      previous === undefined ||
      (previous.fieldId === glyph.fieldId && Math.abs(previous.yMm - glyph.yMm) < 1e-9)
    ) {
      current.push(glyph);
    } else {
      lines.push(current);
      current = [glyph];
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

export function drawGlyphs(input: DrawInput): DrawResult {
  const { page, geometry, font, glyphs } = input;
  // Set the page's default font ONCE. pdf-lib's `drawText` re-registers a font
  // resource every time it is handed an explicit `font`, which would emit one
  // font dictionary and one `/ToUnicode` CMap per drawn line.
  page.setFont(font.pdfFont);
  const pageWidthPt = mmToPt(geometry.pageWidthMm);
  const pageHeightPt = mmToPt(geometry.pageHeightMm);
  const orderIndex = new Map(input.fieldOrder.map((id, index) => [id, index]));
  const sorted = [...glyphs].sort((a, b) => {
    const byField =
      (orderIndex.get(a.fieldId) ?? Number.MAX_SAFE_INTEGER) -
      (orderIndex.get(b.fieldId) ?? Number.MAX_SAFE_INTEGER);
    if (byField !== 0) return byField;
    if (Math.abs(a.yMm - b.yMm) > 1e-9) return a.yMm - b.yMm;
    return a.xMm - b.xMm;
  });

  const lines: DrawnLine[] = [];
  let drawnGlyphs = 0;
  let clippedGlyphs = 0;
  const bounds = {
    minXMm: Number.POSITIVE_INFINITY,
    minYMm: Number.POSITIVE_INFINITY,
    maxXMm: Number.NEGATIVE_INFINITY,
    maxYMm: Number.NEGATIVE_INFINITY,
  };

  for (const line of groupLines(sorted)) {
    const visible: PlacedGlyph[] = [];
    for (const glyph of line) {
      const xPt = mmToPt(glyph.xMm);
      const widthPt = mmToPt(glyph.advanceMm);
      if (xPt + widthPt <= 0 || xPt >= pageWidthPt) {
        clippedGlyphs += 1;
        continue;
      }
      visible.push(glyph);
    }
    if (visible.length === 0) continue;

    const first = visible[0]!;
    const startXPt = mmToPt(first.xMm);
    const baselinePt = pageHeightPt - mmToPt(first.yMm);
    const sizePt = first.fontPt;
    if (!Number.isFinite(startXPt) || !Number.isFinite(baselinePt) || !Number.isFinite(sizePt)) {
      throw new Error(
        `non-finite text position for field ${first.fieldId}: x=${first.xMm} y=${first.yMm} pt=${first.fontPt}`,
      );
    }
    const text = visible.map((glyph) => String.fromCodePoint(glyph.codePoint)).join('');
    const runWidthPt = visible.reduce((total, glyph) => total + mmToPt(glyph.advanceMm), 0);

    const overflowsHorizontally =
      startXPt < -CLIP_EPSILON_PT || startXPt + runWidthPt > pageWidthPt + CLIP_EPSILON_PT;
    const overflowsVertically =
      baselinePt + sizePt > pageHeightPt + CLIP_EPSILON_PT ||
      baselinePt - sizePt < -CLIP_EPSILON_PT;

    if (overflowsHorizontally || overflowsVertically) {
      // One graphics state, one clip, one draw, then restore: the clip cannot
      // leak into the next line.
      page.pushOperators(pushGraphicsState(), ...rectPath(0, 0, pageWidthPt, pageHeightPt));
      page.drawText(text, {
        x: startXPt,
        y: baselinePt,
        size: sizePt,
        color: rgb(0, 0, 0),
      });
      page.pushOperators(popGraphicsState());
    } else {
      page.drawText(text, {
        x: startXPt,
        y: baselinePt,
        size: sizePt,
        color: rgb(0, 0, 0),
      });
    }

    drawnGlyphs += visible.length;
    lines.push({
      fieldId: first.fieldId,
      text,
      glyphCount: visible.length,
      startXMm: first.xMm,
      baselineYMm: first.yMm,
    });
    for (const glyph of visible) {
      bounds.minXMm = Math.min(bounds.minXMm, glyph.xMm);
      bounds.minYMm = Math.min(bounds.minYMm, glyph.yMm - sizePt);
      bounds.maxXMm = Math.max(bounds.maxXMm, glyph.xMm + glyph.advanceMm);
      bounds.maxYMm = Math.max(bounds.maxYMm, glyph.yMm);
    }
  }

  return {
    lines,
    inkBoundsMm: drawnGlyphs === 0 ? undefined : bounds,
    drawnGlyphs,
    clippedGlyphs,
  };
}
