import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountToWords, JOD, USD, type CurrencyWords } from '../src/index.ts';

const ar = (amount: string, extra: Record<string, unknown> = {}) =>
  amountToWords({ amount, currency: JOD, lang: 'ar', ...extra });

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

for (const [amount, expected] of CASES) {
  test(`ar JOD ${amount}`, () => assert.equal(ar(amount), expected));
}

test('fraction as words', () => {
  assert.equal(
    ar('3355.515', { fractionStyle: 'words' }),
    'ثلاثة آلاف وثلاثمائة وخمسة وخمسون دينارا وخمسمائة وخمسة عشر فلسا فقط',
  );
});

test('closing word can be turned off (layout decides the closing line)', () => {
  assert.equal(ar('5', { closing: false }), 'خمسة دنانير');
});

test('feminine currency noun agrees with the number', () => {
  const lira: CurrencyWords = {
    code: 'XXL',
    minorDigits: 2,
    ar: {
      main: { singular: 'ليرة', plural: 'ليرات', gender: 'f' },
      fraction: { singular: 'قرش', plural: 'قروش', gender: 'm' },
    },
    en: { main: { singular: 'lira', plural: 'liras' }, fraction: { singular: 'piastre', plural: 'piastres' } },
  };
  const f = (a: string) => amountToWords({ amount: a, currency: lira, lang: 'ar' });
  assert.equal(f('1'), 'ليرة واحدة فقط');
  assert.equal(f('2'), 'ليرتان اثنتان فقط');
  assert.equal(f('3'), 'ثلاث ليرات فقط');
  assert.equal(f('11'), 'إحدى عشرة ليرة فقط');
  assert.equal(f('21'), 'إحدى وعشرون ليرة فقط');
});

test('two-decimal currency (USD)', () => {
  assert.equal(amountToWords({ amount: '12.05', currency: USD, lang: 'ar' }), 'اثنا عشر دولارا و 5 سنتات فقط');
});

test('never rounds silently: too many decimals is an error', () => {
  assert.throws(() => ar('514.99999999987267'), { code: 'TOO_MANY_DECIMALS' });
  assert.throws(() => ar('1.2345'), { code: 'TOO_MANY_DECIMALS' });
});

test('trailing zeros beyond the currency digits are accepted', () => {
  assert.equal(ar('5.5000'), ar('5.500'));
});

test('invalid input is rejected, not guessed', () => {
  for (const bad of ['', 'abc', '-5', '1e3', '1,000', '1.', '.5', ' ']) {
    assert.throws(() => ar(bad), { code: 'INVALID_AMOUNT' }, bad);
  }
  assert.throws(() => ar('1'.repeat(19)), { code: 'AMOUNT_TOO_LARGE' });
});

test('output is always clean over a wide range', () => {
  const seen = new Set<string>();
  for (let n = 0; n <= 20000; n += 1) {
    const out = ar(String(n));
    assert.ok(out.length > 0);
    assert.ok(!out.includes('  '), `double space for ${n}: ${out}`);
    assert.equal(out, out.trim(), `untrimmed for ${n}`);
    assert.ok(!/undefined|NaN/.test(out), `bad token for ${n}`);
    assert.ok(!/\d/.test(out), `digit in words-only output for ${n}`);
    seen.add(out);
  }
  assert.equal(seen.size, 20001, 'two different numbers produced the same words');
});

test('large values up to 18 digits', () => {
  assert.equal(ar('999999999999999999').includes('undefined'), false);
  assert.ok(ar('1000000000000').startsWith('ترليون'));
});
