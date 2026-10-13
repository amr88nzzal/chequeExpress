/**
 * Bridge between `ttf.ts`/`adapter.ts` and pdf-lib: embeds one face in a
 * `PDFDocument` and exposes what the layout and the writer need.
 */
import type { PDFDocument, PDFFont } from 'pdf-lib';
import { MissingFontError, ShapingError } from '../errors.ts';
import type { ArabicFontInput } from '../types.ts';
import { createFontkitAdapter } from '../font/adapter.ts';
import { parseFont, type FontProgram } from '../font/ttf.ts';

export interface PdfFontHandle {
  readonly bytes: Uint8Array;
  readonly program: FontProgram;
  /** The pdf-lib font, usable with `page.drawText`. */
  readonly pdfFont: PDFFont;
  readonly license: string | undefined;
  readonly name: string | undefined;
  /**
   * Code point used to address `glyphId` through the font's `cmap`. pdf-lib
   * encodes text through `fontkit.layout()`, which is a one-to-one code point
   * -> glyph mapping here, so the code point must be one that resolves back to
   * the same glyph id.
   */
  codePointForGlyph(glyphId: number): number | undefined;
}

export function assertFontBytes(fonts: ArabicFontInput | undefined): ArabicFontInput {
  if (!fonts || !fonts.arabic || fonts.arabic.byteLength === 0) {
    throw new MissingFontError(
      'renderCheque requires fonts.arabic with the TrueType bytes of the approved Arabic face',
    );
  }
  return fonts;
}

export async function buildPdfFont(
  doc: PDFDocument,
  fonts: ArabicFontInput,
  subset: boolean,
): Promise<PdfFontHandle> {
  let program: FontProgram;
  try {
    program = parseFont(fonts.arabic);
  } catch (error) {
    throw new ShapingError(
      `could not parse the supplied font: ${(error as Error).message}`,
      'fonts.arabic',
    );
  }
  doc.registerFontkit(createFontkitAdapter() as never);
  // An explicit custom name keeps pdf-lib from appending a random suffix, which
  // is what makes two renders of the same input byte-identical.
  const customName = (fonts.name ?? program.postscriptName ?? 'Arabic').replace(
    /[^A-Za-z0-9-]/g,
    '',
  );
  const pdfFont = await doc.embedFont(fonts.arabic, {
    subset,
    customName: customName.length > 0 ? customName : 'Arabic',
  });
  const codePointForGlyph = (glyphId: number): number | undefined => {
    const direct = program.codePointsForGlyph(glyphId);
    return direct.length > 0 ? direct[0] : undefined;
  };
  return {
    bytes: fonts.arabic,
    program,
    pdfFont,
    license: fonts.license,
    name: fonts.name ?? program.postscriptName ?? undefined,
    codePointForGlyph,
  };
}
