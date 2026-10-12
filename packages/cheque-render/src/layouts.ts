import type { ChequeLayout } from './types.ts';

/**
 * PLACEHOLDER: size and positions are NOT the real Arab Bank cheque. Replace with measured values
 * (and a calibrated printer profile) before any physical printing. See docs/INPUTS_NEEDED.md.
 */
export const PLACEHOLDER_LAYOUT: ChequeLayout = {
  name: 'PLACEHOLDER-175x93',
  widthMm: 175,
  heightMm: 93,
  fields: [
    { id: 'date', x: 12, y: 12, width: 40, height: 7, align: 'left', fontPt: 11, dir: 'ltr' },
    { id: 'payee', x: 40, y: 27, width: 125, height: 8, align: 'right', fontPt: 12 },
    { id: 'words1', x: 20, y: 40, width: 145, height: 8, align: 'right', fontPt: 11 },
    { id: 'words2', x: 20, y: 49, width: 145, height: 8, align: 'right', fontPt: 11 },
    { id: 'amtMain', x: 115, y: 62, width: 38, height: 9, align: 'center', fontPt: 15, dir: 'ltr' },
    { id: 'amtFrac', x: 155, y: 62, width: 14, height: 9, align: 'center', fontPt: 15, dir: 'ltr' },
    { id: 'memo', x: 20, y: 76, width: 100, height: 7, align: 'right', fontPt: 10 },
  ],
};
