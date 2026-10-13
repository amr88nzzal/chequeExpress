/**
 * `@cheques/cheque-render` - renders a cheque to a PDF whose page size is
 * exactly the cheque size in millimetres, with Arabic shaping (HarfBuzz) and
 * right-to-left ordering (bidi-js), in pure TypeScript. No browser, no
 * Chromium, no environment variables and no module-level mutable state.
 *
 * Public surface:
 * - `renderCheque(layout, profile, data, options): Promise<Uint8Array>`
 * - `renderChequeToFile(layout, profile, data, options, path): Promise<void>`
 * - `renderChequeInspect(...)`: the same render plus its geometry and drawing plan
 */
export { renderCheque, renderChequeInspect, FIELD_IDS, AMOUNT_FIELD_IDS } from './render.ts';
export type { RenderInspection } from './render.ts';
export { renderChequeToFile } from './write.ts';
export { deriveAmountFigures, assertDecimalDigits } from './amount.ts';
export type { AmountFigures } from './amount.ts';
export { resolveGeometry, validateLayout, validateProfile, clamp } from './geometry.ts';
export type { PageGeometry } from './geometry.ts';
export { layoutField, wrapText, completeLine } from './layout.ts';
export type { PlacedField, PlacedGlyph, ResolvedFontMetrics } from './layout.ts';
export { shapeText, advanceOf } from './text/shape.ts';
export type { ShapedGlyph, ShapedText, TextFont } from './text/shape.ts';
export { parseFont } from './font/ttf.ts';
export type { FontProgram, GlyphData, GlyphMetrics, GlyphOutline } from './font/ttf.ts';
export { FontSubsetBuilder } from './font/subset.ts';
export { createFontkitAdapter } from './font/adapter.ts';
export { PT_PER_MM, mmToPt, ptToMm, boxMmToPt } from './units.ts';
export type { BoxMm, BoxPt } from './units.ts';
export {
  ChequeRenderError,
  MissingFontError,
  InvalidAmountError,
  InvalidFieldError,
  InvalidLayoutError,
  InvalidProfileError,
  ShapingError,
} from './errors.ts';
export type { ChequeRenderErrorCode } from './errors.ts';
export type {
  ArabicFontInput,
  ChequeData,
  ChequeLayout,
  Field,
  FieldAlign,
  PaperMode,
  PrinterProfile,
  RenderOptions,
  TextDir,
} from './types.ts';
export { A4_HEIGHT_MM, A4_WIDTH_MM } from './types.ts';
