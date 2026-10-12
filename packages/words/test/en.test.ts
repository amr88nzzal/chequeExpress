import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountToWords, JOD, USD } from '../src/index.ts';

const en = (amount: string, currency = JOD, extra: Record<string, unknown> = {}) =>
  amountToWords({ amount, currency, lang: 'en', ...extra });

test('english JOD', () => {
  assert.equal(en('3355.515'), 'Only three thousand three hundred fifty-five dinars and 515 fils');
  assert.equal(en('1'), 'Only one dinar');
  assert.equal(en('0'), 'Only zero dinars');
  assert.equal(en('0.5'), 'Only 500 fils');
  assert.equal(en('101'), 'Only one hundred one dinars');
  assert.equal(en('1000000'), 'Only one million dinars');
});

test('english USD and fraction words', () => {
  assert.equal(en('12.05', USD), 'Only twelve dollars and 5 cents');
  assert.equal(en('2.21', USD, { fractionStyle: 'words' }), 'Only two dollars and twenty-one cents');
});
