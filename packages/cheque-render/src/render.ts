/**
 * `renderCheque` - the package's single rendering entry point.
 *
 * It is a pure function: no environment variables, no module-level mutable
 * state, no clock, no file system. `renderChequeToFile` is the only place that
 * touches disk, and it is a thin wrapper in `index.ts`.
 *
 * Determinism: the font is embedded under an explicit `customName` (pdf-lib
 * otherwise appends a random suffix) and the PDF creation date is fixed unless
 * `RenderOptions.createdAt` says otherwise, so two renders of the same input
 * produce byte-identical output.
 */
import { PDFDocument } from 'pdf-lib';
import { deriveAmountFigures } from './amount.ts';
import { InvalidLayoutError } from './errors.ts';
import { resolveGeometry } from './geometry.ts';
import { layoutField, type PlacedField, type PlacedGlyph } from './layout.ts';
import { assertFontBytes, buildPdfFont } from './pdf/fonts.ts';
import { drawGlyphs, type DrawnLine } from './pdf/writer.ts';
import type { ChequeData, ChequeLayout, PrinterProfile, RenderOptions } from './types.ts';

/**
 * Field ids the renderer fills, by role. The first id of each role is the one
 * the project's documentation uses; the aliases exist so a bank layout can use
 * either the design names or the spike's names.
 */
export const FIELD_IDS: { readonly [role: string]: readonly string[] } = {
  date: ['date', 'issueDate'],
  payee: ['payee', 'beneficiary'],
  words1: ['amountWordsLine1', 'amountWords1', 'words1'],
  words2: ['amountWordsLine2', 'amountWords2', 'words2'],
  dinar: ['amountDinar', 'amountFiguresDinar', 'amt_main', 'amountFigures'],
  fils: ['amountFils', 'amountFiguresFils', 'amt_frac'],
  memo: ['memo', 'note', 'remark'],
};

/** Field ids that receive the amount in figures. */
export const AMOUNT_FIELD_IDS: readonly string[] = [...FIELD_IDS.dinar!, ...FIELD_IDS.fils!];

const PROJECT_TITLE = 'ChequeExpress cheque';
const PDF_EPOCH = new Date(0);

export interface RenderInspection {
  readonly bytes: Uint8Array;
  readonly pageWidthMm: number;
  readonly pageHeightMm: number;
  readonly contentXMm: number;
  readonly contentYMm: number;
  readonly lines: readonly DrawnLine[];
  readonly fields: readonly PlacedField[];
  readonly figures: { readonly dinar: string; readonly fils: string };
}

/**
 * Renders one cheque to PDF bytes.
 *
 * @throws MissingFontError when `options.fonts.arabic` is absent.
 * @throws InvalidAmountError when the words lines do not carry exactly two
 *         decimal fields.
 * @throws InvalidFieldError when a field is degenerate (for example zero width).
 */
export async function renderCheque(
  layout: ChequeLayout,
  profile: PrinterProfile,
  data: ChequeData,
  options: RenderOptions,
): Promise<Uint8Array> {
  const inspected = await renderChequeInspect(layout, profile, data, options);
  return Uint8Array.from(inspected.bytes);
}

/**
 * Same as `renderCheque`, plus the geometry and the drawing plan. Tests and the
 * print preview use this; production callers use `renderCheque`.
 */
export async function renderChequeInspect(
  layout: ChequeLayout,
  profile: PrinterProfile,
  data: ChequeData,
  options: RenderOptions,
): Promise<RenderInspection> {
  const fonts = assertFontBytes(options.fonts);
  const amount = deriveAmountFigures(data);
  const geometry = resolveGeometry(layout, profile);
  if (!Array.isArray(layout.fields)) {
    throw new InvalidLayoutError('layout.fields must be an array', 'fields');
  }

  const doc = await PDFDocument.create();
  const font = await buildPdfFont(doc, fonts, options.subset ?? true);
  const page = doc.addPage([mmToPtLocal(geometry.pageWidthMm), mmToPtLocal(geometry.pageHeightMm)]);

  const placed: PlacedGlyph[] = [];
  const placedFields: PlacedField[] = [];
  for (const field of layout.fields) {
    const text = textForField(field.id, data, amount);
    if (text === undefined) continue;
    const box = {
      xMm: geometry.contentXMm + field.xMm,
      yMm: geometry.contentYMm + field.yMm,
      wMm: field.wMm,
      hMm: field.hMm,
    };
    const fieldResult = layoutField({
      field,
      text,
      box,
      font: { bytes: font.bytes, unitsPerEm: font.program.unitsPerEm, notdefGlyphIds: [0] },
      metrics: {
        unitsPerEm: font.program.unitsPerEm,
        ascenderUnits: font.program.ascent,
        descenderUnits: font.program.descent,
      },
      codePointForGlyph: font.codePointForGlyph,
    });
    placedFields.push(fieldResult);
    placed.push(...fieldResult.glyphs);
  }

  const drawing = drawGlyphs({
    page,
    geometry,
    font,
    glyphs: placed,
    fieldOrder: layout.fields.map((field) => field.id),
  });

  doc.setTitle(options.title ?? PROJECT_TITLE);
  doc.setCreator('@cheques/cheque-render');
  doc.setProducer('@cheques/cheque-render (pdf-lib)');
  doc.setSubject(
    font.license === undefined
      ? 'Arabic font licence not recorded'
      : `Arabic font: ${font.name ?? 'unnamed'} (${font.license})`,
  );
  doc.setCreationDate(options.createdAt ?? PDF_EPOCH);
  doc.setModificationDate(options.createdAt ?? PDF_EPOCH);

  const bytes = await doc.save();
  return {
    bytes,
    pageWidthMm: geometry.pageWidthMm,
    pageHeightMm: geometry.pageHeightMm,
    contentXMm: geometry.contentXMm,
    contentYMm: geometry.contentYMm,
    lines: drawing.lines,
    fields: placedFields,
    figures: { dinar: amount.dinar, fils: amount.fils },
  };
}

function mmToPtLocal(mm: number): number {
  return (mm * 72) / 25.4;
}

function textForField(
  id: string,
  data: ChequeData,
  amount: { readonly dinar: string; readonly fils: string },
): string | undefined {
  if (FIELD_IDS.date!.includes(id)) return data.issueDate;
  if (FIELD_IDS.payee!.includes(id)) return data.payee;
  if (FIELD_IDS.words1!.includes(id)) return data.amountWordsLine1;
  if (FIELD_IDS.words2!.includes(id))
    return `${data.amountWordsLine2} ${data.closingPhrase}`.trim();
  if (FIELD_IDS.dinar!.includes(id)) return amount.dinar;
  if (FIELD_IDS.fils!.includes(id)) return amount.fils;
  if (FIELD_IDS.memo!.includes(id)) return data.memo;
  return undefined;
}
