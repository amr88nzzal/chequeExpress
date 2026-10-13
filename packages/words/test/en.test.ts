import { describe, expect, it } from 'vitest';
import { amountToWords, JOD, USD } from '../src/index.ts';

/** English expectations come from the legacy unit, so they keep the "Only" prefix. */
const en = (amount: string, currency = JOD, extra: Record<string, unknown> = {}) =>
  amountToWords({ amount, currency, lang: 'en', closing: true, ...extra });

describe('en', () => {
  it('english JOD', () => {
    expect(en('3355.515')).toBe('Only three thousand three hundred fifty-five dinars and 515 fils');
    expect(en('1')).toBe('Only one dinar');
    expect(en('0')).toBe('Only zero dinars');
    expect(en('0.5')).toBe('Only 500 fils');
    expect(en('101')).toBe('Only one hundred one dinars');
    expect(en('1000000')).toBe('Only one million dinars');
  });

  it('english USD and fraction words', () => {
    expect(en('12.05', USD)).toBe('Only twelve dollars and 5 cents');
    expect(en('2.21', USD, { fractionStyle: 'words' })).toBe(
      'Only two dollars and twenty-one cents',
    );
  });

  it('defaults to no "Only" prefix (the print template appends it)', () => {
    for (const amount of ['0', '1', '12.05']) {
      const out = amountToWords({ amount, currency: USD, lang: 'en' });
      expect(out).not.toContain('Only');
      expect(out).toBe(amountToWords({ amount, currency: USD, lang: 'en', closing: false }));
    }
  });
});
