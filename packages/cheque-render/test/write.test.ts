/**
 * The thin file wrapper, and the proof that the core renderer never touches disk.
 */
import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderCheque, renderChequeToFile } from '../src/index.ts';
import { TEST_DATA, TEST_FONTS, TEST_LAYOUT } from './fixtures.ts';
import { TOLERANCE_MM } from './expected-positions.ts';
import { PdfReader } from './helpers/pdf-reader.ts';

const PROFILE = { dxMm: 1.5, dyMm: -0.8, paperMode: 'custom' } as const;

describe('renderChequeToFile', () => {
  const target = resolve(import.meta.dirname, '.tmp-out', 'cheque.pdf');

  it('writes the same bytes the in-memory renderer produces', async () => {
    await renderChequeToFile(TEST_LAYOUT, PROFILE, TEST_DATA, { fonts: TEST_FONTS }, target);
    const onDisk = new Uint8Array(readFileSync(target));
    const inMemory = await renderCheque(TEST_LAYOUT, PROFILE, TEST_DATA, { fonts: TEST_FONTS });
    expect(onDisk.length).toBe(inMemory.length);
    let identical = true;
    for (let i = 0; i < onDisk.length; i += 1) {
      if (onDisk[i] !== inMemory[i]) identical = false;
    }
    expect(identical).toBe(true);

    const reader = await PdfReader.load(onDisk);
    const size = reader.pageSizeMm();
    expect(Math.abs(size.widthMm - TEST_LAYOUT.widthMm)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs(size.heightMm - TEST_LAYOUT.heightMm)).toBeLessThanOrEqual(TOLERANCE_MM);
  });

  it('leaves no temporary file behind', async () => {
    await rm(target, { force: true });
    await rm(resolve(import.meta.dirname, '.tmp-out'), { recursive: true, force: true });
    let exists = true;
    try {
      readFileSync(target);
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });
});
