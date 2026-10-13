import { amountToWords, JOD } from '../src/index.ts';

export type GoldenRow = { amount: string; expected: string };
export type Mismatch = GoldenRow & {
  /** Words we produced, or a diagnostic when the amount could not be parsed at all. */
  actual: string;
  /** Set when the row could not be compared because the amount is not a plain decimal. */
  error?: string;
};

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

const HEADER = ['amount', 'words'];

/**
 * Reads a golden CSV exported from the Excel/VBA unit. Fails loudly instead of
 * returning zero rows: a comparison over an empty file would otherwise pass
 * vacuously and hide a broken or missing export.
 */
export const readGolden = (csv: string): GoldenRow[] => {
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    throw new Error('golden CSV is empty: expected a "amount,words" header plus at least one case');
  }

  const [header, ...cases] = rows;
  if (
    header[0]?.trim().toLowerCase() !== HEADER[0] ||
    header[1]?.trim().toLowerCase() !== HEADER[1]
  ) {
    throw new Error(
      `golden CSV must start with the header "${HEADER.join(',')}", got "${header.join(',')}"`,
    );
  }
  if (cases.length === 0) {
    throw new Error('golden CSV has a header but no cases: the Excel export produced no rows');
  }

  return cases.map(([amount, expected]) => ({
    amount: (amount ?? '').trim(),
    expected: (expected ?? '').trim(),
  }));
};

/** Words as the VBA module prints them for the Excel call, with the closing word included. */
export const ours = (amount: string): string =>
  amountToWords({ amount, currency: JOD, lang: 'ar', closing: true });

export const compareGolden = (rows: GoldenRow[]): { total: number; mismatches: Mismatch[] } => {
  const mismatches: Mismatch[] = [];
  for (const row of rows) {
    let actual: string;
    try {
      actual = ours(row.amount);
    } catch (error) {
      // A real Excel export contains artefacts such as 514.99999999987267.
      // Report them instead of aborting the whole run with an uncaught throw.
      const message = error instanceof Error ? error.message : String(error);
      mismatches.push({ ...row, actual: `<unparseable amount: ${message}>`, error: message });
      continue;
    }
    if (actual !== row.expected) mismatches.push({ ...row, actual });
  }
  return { total: rows.length, mismatches };
};
