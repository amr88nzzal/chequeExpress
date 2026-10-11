import { amountToWords, JOD } from '../src/index.ts';

export type GoldenRow = { amount: string; expected: string };
export type Mismatch = GoldenRow & { actual: string };

/** Minimal RFC-4180 style parser: BOM, CRLF, quoted fields, "" escapes. */
export const parseCsv = (text: string): string[][] => {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

export const readGolden = (csv: string): GoldenRow[] =>
  parseCsv(csv)
    .filter((r) => r[0] !== 'amount')
    .map(([amount, expected]) => ({ amount: amount.trim(), expected: (expected ?? '').trim() }));

/** Words as the VBA module prints them for the Excel call, with the closing word included. */
export const ours = (amount: string): string =>
  amountToWords({ amount, currency: JOD, lang: 'ar' });

export const compareGolden = (rows: GoldenRow[]): { total: number; mismatches: Mismatch[] } => {
  const mismatches: Mismatch[] = [];
  for (const r of rows) {
    const actual = ours(r.amount);
    if (actual !== r.expected) mismatches.push({ ...r, actual });
  }
  return { total: rows.length, mismatches };
};
