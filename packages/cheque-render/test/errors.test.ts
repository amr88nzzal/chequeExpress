/**
 * Failure paths: each one must reject with a typed error, not with a silent
 * fallback and not with a generic `Error`.
 */
import {
  InvalidAmountError,
  InvalidFieldError,
  MissingFontError,
  deriveAmountFigures,
  renderCheque,
} from '../src/index.ts';
import type { ChequeData, ChequeLayout } from '../src/types.ts';
import { TEST_DATA, TEST_FONTS, TEST_LAYOUT } from './fixtures.ts';

const PROFILE = { dxMm: 0, dyMm: 0, paperMode: 'custom' } as const;

describe('failure paths', () => {
  it('rejects an amount that is not a plain decimal string', () => {
    const bad: ChequeData = { ...TEST_DATA, amountWordsLine1: 'مال 3,355' };
    expect(() => deriveAmountFigures(bad)).toThrow(InvalidAmountError);

    const fractional: ChequeData = {
      ...TEST_DATA,
      amountWordsLine1: 'مال 3355.515',
      amountWordsLine2: '0',
    };
    expect(() => deriveAmountFigures(fractional)).toThrow(InvalidAmountError);

    const missing: ChequeData = {
      ...TEST_DATA,
      amountWordsLine1: 'مال',
      amountWordsLine2: 'بلا أرقام',
    };
    expect(() => deriveAmountFigures(missing)).toThrow(InvalidAmountError);
  });

  it('rejects a field with zero width before drawing anything', async () => {
    const layout: ChequeLayout = {
      widthMm: 175,
      heightMm: 93,
      fields: [
        {
          id: 'payee',
          xMm: 40,
          yMm: 27,
          wMm: 0,
          hMm: 8,
          align: 'right',
          fontPt: 12,
          lineHeightMm: 8,
        },
      ],
    };
    let caught: unknown;
    try {
      await renderCheque(layout, PROFILE, TEST_DATA, { fonts: TEST_FONTS });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidFieldError);
  });

  it('rejects a missing font with a typed error', async () => {
    let caught: unknown;
    try {
      await renderCheque(TEST_LAYOUT, PROFILE, TEST_DATA, {
        fonts: { arabic: new Uint8Array(0) },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MissingFontError);
  });

  it('rejects a non-finite offset', async () => {
    let caught: unknown;
    try {
      await renderCheque(
        TEST_LAYOUT,
        { dxMm: Number.NaN, dyMm: 0, paperMode: 'custom' },
        TEST_DATA,
        {
          fonts: TEST_FONTS,
        },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect((caught as Error).name).toBe('InvalidProfileError');
  });

  it('rejects a degenerate layout size', async () => {
    let caught: unknown;
    try {
      await renderCheque({ widthMm: 0, heightMm: 93, fields: [] }, PROFILE, TEST_DATA, {
        fonts: TEST_FONTS,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect((caught as Error).name).toBe('InvalidLayoutError');
  });

  it('rejects a font that is not a TrueType file', async () => {
    let caught: unknown;
    try {
      await renderCheque(TEST_LAYOUT, PROFILE, TEST_DATA, {
        fonts: { arabic: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect((caught as Error).name).toBe('ShapingError');
  });
});
