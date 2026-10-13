import { describe, expect, it } from 'vitest';
import { amountToWords, JOD, USD, parseAmount, type CurrencyWords } from '../src/index.ts';

/** JOD/ar with the closing word kept, because those expectations come from the Excel/VBA unit. */
const ar = (amount: string, extra: Record<string, unknown> = {}) =>
  amountToWords({ amount, currency: JOD, lang: 'ar', closing: true, ...extra });

// Expected values were written from Arabic number grammar, then reviewed by eye.
// The golden tests (golden.test.ts) compare against the existing Excel/VBA module.
const CASES: [string, string][] = [
  ['3355.515', 'ثلاثة آلاف وثلاثمائة وخمسة وخمسون دينارا و 515 فلس فقط'], // taken from the Excel sheet
  ['0', 'صفر دينار فقط'],
  ['1', 'دينار واحد فقط'],
  ['2', 'ديناران اثنان فقط'],
  ['3', 'ثلاثة دنانير فقط'],
  ['8', 'ثمانية دنانير فقط'],
  ['10', 'عشرة دنانير فقط'],
  ['11', 'أحد عشر دينارا فقط'],
  ['12', 'اثنا عشر دينارا فقط'],
  ['19', 'تسعة عشر دينارا فقط'],
  ['21', 'واحد وعشرون دينارا فقط'],
  ['22', 'اثنان وعشرون دينارا فقط'],
  ['99', 'تسعة وتسعون دينارا فقط'],
  ['100', 'مائة دينار فقط'],
  ['101', 'مائة ودينار واحد فقط'],
  ['102', 'مائة وديناران اثنان فقط'],
  ['103', 'مائة وثلاثة دنانير فقط'],
  ['111', 'مائة وأحد عشر دينارا فقط'],
  ['200', 'مائتا دينار فقط'],
  ['201', 'مائتان ودينار واحد فقط'],
  ['300', 'ثلاثمائة دينار فقط'],
  ['999', 'تسعمائة وتسعة وتسعون دينارا فقط'],
  ['1000', 'ألف دينار فقط'],
  ['1001', 'ألف ودينار واحد فقط'],
  ['1100', 'ألف ومائة دينار فقط'],
  ['2000', 'ألفا دينار فقط'],
  ['3000', 'ثلاثة آلاف دينار فقط'],
  ['10000', 'عشرة آلاف دينار فقط'],
  ['11000', 'أحد عشر ألف دينار فقط'],
  ['12000', 'اثنا عشر ألف دينار فقط'],
  ['25300', 'خمسة وعشرون ألفا وثلاثمائة دينار فقط'],
  ['100000', 'مائة ألف دينار فقط'],
  ['200000', 'مائتا ألف دينار فقط'],
  ['1000000', 'مليون دينار فقط'],
  ['2000000', 'مليونا دينار فقط'],
  ['1000001', 'مليون ودينار واحد فقط'],
  ['1234567.89', 'مليون ومائتان وأربعة وثلاثون ألفا وخمسمائة وسبعة وستون دينارا و 890 فلس فقط'],
  ['0.5', '500 فلس فقط'],
  ['0.001', '1 فلس فقط'],
  ['0.015', '15 فلس فقط'],
  ['1500.250', 'ألف وخمسمائة دينار و 250 فلس فقط'],
];

describe('ar', () => {
  for (const [amount, expected] of CASES) {
    it(`JOD ${amount}`, () => {
      expect(ar(amount)).toBe(expected);
    });
  }

  it('defaults to no closing word (the print template appends «فقط»)', () => {
    for (const amount of ['0', '1', '5', '3355.515']) {
      const out = amountToWords({ amount, currency: JOD, lang: 'ar' });
      expect(out).not.toContain('فقط');
      expect(out).toBe(ar(amount).replace(/ فقط$/, ''));
    }
    expect(amountToWords({ amount: '12.05', currency: USD, lang: 'ar' })).not.toContain('فقط');
  });

  it('closing word can be turned on explicitly (layout decides the closing line)', () => {
    expect(ar('5', { closing: true })).toBe('خمسة دنانير فقط');
  });

  it('fraction as words', () => {
    expect(ar('3355.515', { fractionStyle: 'words' })).toBe(
      'ثلاثة آلاف وثلاثمائة وخمسة وخمسون دينارا وخمسمائة وخمسة عشر فلسا فقط',
    );
  });

  it('feminine currency noun agrees with the number', () => {
    const lira: CurrencyWords = {
      code: 'XXL',
      minorDigits: 2,
      ar: {
        main: { singular: 'ليرة', plural: 'ليرات', gender: 'f' },
        fraction: { singular: 'قرش', plural: 'قروش', gender: 'm' },
      },
      en: {
        main: { singular: 'lira', plural: 'liras' },
        fraction: { singular: 'piastre', plural: 'piastres' },
      },
    };
    const f = (a: string) =>
      amountToWords({ amount: a, currency: lira, lang: 'ar', closing: true });
    expect(f('1')).toBe('ليرة واحدة فقط');
    expect(f('2')).toBe('ليرتان اثنتان فقط');
    expect(f('3')).toBe('ثلاث ليرات فقط');
    expect(f('11')).toBe('إحدى عشرة ليرة فقط');
    expect(f('21')).toBe('إحدى وعشرون ليرة فقط');
  });

  it('two-decimal currency (USD)', () => {
    expect(amountToWords({ amount: '12.05', currency: USD, lang: 'ar', closing: true })).toBe(
      'اثنا عشر دولارا و 5 سنتات فقط',
    );
  });

  it('never rounds silently: too many decimals is an error', () => {
    expect(() => ar('514.99999999987267')).toThrow(
      expect.objectContaining({ code: 'TOO_MANY_DECIMALS' }),
    );
    expect(() => ar('1.2345')).toThrow(expect.objectContaining({ code: 'TOO_MANY_DECIMALS' }));
  });

  it('trailing zeros beyond the currency digits are accepted', () => {
    expect(ar('5.5000')).toBe(ar('5.500'));
  });

  it('invalid input is rejected, not guessed', () => {
    for (const bad of ['', 'abc', '-5', '1e3', '1,000', '1.', '.5', ' ']) {
      expect(() => ar(bad), bad).toThrow(expect.objectContaining({ code: 'INVALID_AMOUNT' }));
    }
    expect(() => ar('1'.repeat(19))).toThrow(expect.objectContaining({ code: 'AMOUNT_TOO_LARGE' }));
  });
});

describe('parseAmount currency digits', () => {
  it('rejects a non-integer minorDigits', () => {
    expect(() => parseAmount('5.5', 2.5)).toThrow(
      expect.objectContaining({ code: 'INVALID_AMOUNT' }),
    );
  });

  it('rejects a negative minorDigits', () => {
    expect(() => parseAmount('5', -1)).toThrow(expect.objectContaining({ code: 'INVALID_AMOUNT' }));
  });

  it('accepts the lower boundary 0', () => {
    expect(parseAmount('5', 0)).toEqual({ integer: 5n, fraction: 0n, minorDigits: 0 });
    // A zero-decimal currency never rounds: a fraction is still an error.
    expect(() => parseAmount('5.9', 0)).toThrow(
      expect.objectContaining({ code: 'TOO_MANY_DECIMALS' }),
    );
  });

  it('accepts the upper boundary 6', () => {
    expect(parseAmount('1.123456', 6)).toEqual({
      integer: 1n,
      fraction: 123456n,
      minorDigits: 6,
    });
    expect(() => parseAmount('1.1234567', 6)).toThrow(
      expect.objectContaining({ code: 'TOO_MANY_DECIMALS' }),
    );
  });
});

describe('output', () => {
  it('is always clean over a wide range', () => {
    const seen = new Set<string>();
    for (let n = 0; n <= 20000; n += 1) {
      const out = ar(String(n));
      expect(out.length).toBeGreaterThan(0);
      expect(out, `double space for ${n}: ${out}`).not.toContain('  ');
      expect(out, `untrimmed for ${n}`).toBe(out.trim());
      expect(out, `bad token for ${n}`).not.toMatch(/undefined|NaN/);
      expect(out, `digit in words-only output for ${n}`).not.toMatch(/\d/);
      seen.add(out);
    }
    expect(seen.size, 'two different numbers produced the same words').toBe(20001);
  });

  it('large values up to 18 digits', () => {
    expect(ar('999999999999999999').includes('undefined')).toBe(false);
    expect(ar('1000000000000').startsWith('ترليون')).toBe(true);
  });
});
