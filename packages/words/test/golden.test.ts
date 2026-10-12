import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { compareGolden, parseCsv, readGolden } from './golden-lib.ts';

const GOLDEN = new URL('./golden/jod-ar.csv', import.meta.url);
const KNOWN = new URL('./golden/known-differences.json', import.meta.url);

test('csv parser handles BOM, CRLF, quotes and escaped quotes', () => {
  const rows = parseCsv('\uFEFFamount,words\r\n"1.000","a, b"\r\n"2.000","say ""x"""\r\n');
  assert.deepEqual(rows, [['amount', 'words'], ['1.000', 'a, b'], ['2.000', 'say "x"']]);
});

test('comparison reports exactly the rows that differ', () => {
  const { total, mismatches } = compareGolden([
    { amount: '3355.515', expected: 'ثلاثة آلاف وثلاثمائة وخمسة وخمسون دينارا و 515 فلس فقط' },
    { amount: '5', expected: 'خمسة دينار فقط' },
  ]);
  assert.equal(total, 2);
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].amount, '5');
  assert.equal(mismatches[0].actual, 'خمسة دنانير فقط');
});

test('golden cases exported from the Excel/VBA module', { skip: !existsSync(GOLDEN) && 'golden/jod-ar.csv not provided yet' }, () => {
  const rows = readGolden(readFileSync(GOLDEN, 'utf8'));
  const known: Record<string, string> = existsSync(KNOWN) ? JSON.parse(readFileSync(KNOWN, 'utf8')) : {};
  const { mismatches } = compareGolden(rows);
  const unexplained = mismatches.filter((m) => known[m.amount] === undefined);
  assert.equal(
    unexplained.length,
    0,
    `${unexplained.length} of ${rows.length} cases differ from the VBA module and are not documented in known-differences.json. First 10:\n` +
      unexplained.slice(0, 10).map((m) => `${m.amount}\n  vba : ${m.expected}\n  ours: ${m.actual}`).join('\n'),
  );
});
