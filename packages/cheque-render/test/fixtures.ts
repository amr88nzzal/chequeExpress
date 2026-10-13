/**
 * Shared fixtures for the renderer tests.
 *
 * The layout below is a *placeholder* cheque layout (the real Arab Bank size and
 * the seven measured field boxes are still pending the project owner - see the
 * README). It exists so the geometry, offset, clipping and Arabic tests have a
 * realistic set of boxes to work with.
 *
 * The independent expectation table lives in `expected-positions.ts` and is
 * written from this layout plus the fixture font's metrics; nothing in it is
 * read back out of the renderer.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFont, type FontProgram } from '../src/font/ttf.ts';
import type { ChequeData, ChequeLayout, Field } from '../src/types.ts';

const FIXTURE_PATH = resolve(import.meta.dirname, 'fixtures', 'test-arabic.ttf');

let cachedBytes: Uint8Array | undefined;
let cachedProgram: FontProgram | undefined;

/** Bytes of the package's own test font (`tools/build-test-font.ts`). */
export function testFontBytes(): Uint8Array {
  cachedBytes ??= new Uint8Array(readFileSync(FIXTURE_PATH));
  return cachedBytes;
}

/** Parsed metrics of the test font, read from the file with the package parser. */
export function testFontProgram(): FontProgram {
  cachedProgram ??= parseFont(testFontBytes());
  return cachedProgram;
}

export const PLACEHOLDER_WIDTH_MM = 175;
export const PLACEHOLDER_HEIGHT_MM = 93;

export const TEST_LAYOUT: ChequeLayout = {
  widthMm: PLACEHOLDER_WIDTH_MM,
  heightMm: PLACEHOLDER_HEIGHT_MM,
  fields: [
    { id: 'date', xMm: 12, yMm: 12, wMm: 40, hMm: 7, align: 'left', fontPt: 11, lineHeightMm: 7 },
    {
      id: 'payee',
      xMm: 40,
      yMm: 27,
      wMm: 125,
      hMm: 8,
      align: 'right',
      fontPt: 12,
      lineHeightMm: 8,
    },
    {
      id: 'amountWordsLine1',
      xMm: 20,
      yMm: 40,
      wMm: 145,
      hMm: 8,
      align: 'right',
      fontPt: 11,
      lineHeightMm: 8,
    },
    {
      id: 'amountWordsLine2',
      xMm: 20,
      yMm: 49,
      wMm: 145,
      hMm: 8,
      align: 'right',
      fontPt: 11,
      lineHeightMm: 8,
    },
    {
      id: 'amountDinar',
      xMm: 115,
      yMm: 62,
      wMm: 38,
      hMm: 9,
      align: 'center',
      fontPt: 15,
      lineHeightMm: 9,
    },
    {
      id: 'amountFils',
      xMm: 155,
      yMm: 62,
      wMm: 14,
      hMm: 9,
      align: 'center',
      fontPt: 15,
      lineHeightMm: 9,
    },
    { id: 'memo', xMm: 20, yMm: 76, wMm: 100, hMm: 7, align: 'right', fontPt: 10, lineHeightMm: 7 },
  ],
};

/**
 * Data that only uses code points the fixture font can actually draw, so that
 * every field yields ink and the geometry assertions have something to measure.
 *
 * The amount in words carries the two decimal fields; the figures cells are
 * derived from those lines by the renderer, never supplied separately.
 */
export const TEST_DATA: ChequeData = {
  issueDate: '2026',
  payee: 'محمد',
  amountWordsLine1: 'مال 3355',
  amountWordsLine2: '515',
  memo: 'لم',
  closingPhrase: 'لا',
};

export function fieldById(id: string, layout: ChequeLayout = TEST_LAYOUT): Field {
  const field = layout.fields.find((entry: Field) => entry.id === id);
  if (!field) throw new Error(`no field ${id} in the test layout`);
  return field;
}

export const TEST_FONTS = {
  get arabic(): Uint8Array {
    return testFontBytes();
  },
  license: 'TEST-ONLY (see tools/build-test-font.ts)',
  name: 'ChequeRenderTestArabic',
};
