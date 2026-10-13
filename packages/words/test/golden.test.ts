import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareGolden, parseCsv, readGolden } from './golden-lib.ts';

const GOLDEN_PATH = fileURLToPath(new URL('./golden/jod-ar.csv', import.meta.url));
const KNOWN_PATH = fileURLToPath(new URL('./golden/known-differences.json', import.meta.url));

describe('golden', () => {
  it('csv parser handles BOM, CRLF, quotes and escaped quotes', () => {
    const rows = parseCsv('\uFEFFamount,words\r\n"1.000","a, b"\r\n"2.000","say ""x"""\r\n');
    expect(rows).toEqual([
      ['amount', 'words'],
      ['1.000', 'a, b'],
      ['2.000', 'say "x"'],
    ]);
  });

  it('comparison reports exactly the rows that differ', () => {
    const { total, mismatches } = compareGolden([
      { amount: '3355.515', expected: 'ثلاثة آلاف وثلاثمائة وخمسة وخمسون دينارا و 515 فلس فقط' },
      { amount: '5', expected: 'خمسة دينار فقط' },
    ]);
    expect(total).toBe(2);
    expect(mismatches.length).toBe(1);
    expect(mismatches[0].amount).toBe('5');
    expect(mismatches[0].actual).toBe('خمسة دنانير فقط');
  });

  it('an empty or header-only golden CSV fails loudly instead of passing vacuously', () => {
    expect(() => readGolden('')).toThrow(/empty/i);
    expect(() => readGolden('\uFEFFamount,words\r\n')).toThrow(/no cases/i);
    expect(() => readGolden('foo,bar\r\n1,2\r\n')).toThrow(/header/i);
    // The old failure mode: no rows meant { total: 0 } and a green suite.
    expect(() => compareGolden(readGolden(''))).toThrow();
  });

  it('an amount that cannot be parsed is reported as a mismatch, not thrown', () => {
    const rows = [
      { amount: '514.99999999987267', expected: 'خمسمائة وأربعة عشر دينارا و 999 فلس فقط' },
      { amount: '1e3', expected: 'ألف دينار فقط' },
      { amount: '5', expected: 'خمسة دنانير فقط' },
    ];
    const { total, mismatches } = compareGolden(rows);
    expect(total).toBe(3);
    expect(mismatches.length).toBe(2);
    expect(mismatches[0].error).toMatch(/allows 3 decimal digits/);
    expect(mismatches[0].actual).toContain('unparseable');
    expect(mismatches[1].error).toMatch(/plain non-negative decimal string/);
    expect(mismatches[1].actual).toContain('unparseable');
  });

  // Skipped (not failed) while the owner has not supplied the export.
  it.skipIf(!existsSync(GOLDEN_PATH))(
    'golden cases from the Excel/VBA module (test/golden/jod-ar.csv not supplied yet)',
    () => {
      const rows = readGolden(readFileSync(GOLDEN_PATH, 'utf8'));
      const known: Record<string, string> = existsSync(KNOWN_PATH)
        ? JSON.parse(readFileSync(KNOWN_PATH, 'utf8'))
        : {};
      const { mismatches } = compareGolden(rows);
      const unexplained = mismatches.filter((m) => known[m.amount] === undefined);
      const report =
        `${unexplained.length} of ${rows.length} cases differ from the VBA module and are not ` +
        'documented in known-differences.json. First 10:\n' +
        unexplained
          .slice(0, 10)
          .map((m) => `${m.amount}\n  vba : ${m.expected}\n  ours: ${m.actual}`)
          .join('\n');
      expect(unexplained.length, report).toBe(0);
    },
  );
});
