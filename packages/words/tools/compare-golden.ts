// Usage: node tools/compare-golden.ts test/golden/jod-ar.csv
import { readFileSync } from 'node:fs';
import { compareGolden, readGolden } from '../test/golden-lib.ts';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/compare-golden.ts <golden.csv>');
  process.exit(2);
}
const { total, mismatches } = compareGolden(readGolden(readFileSync(file, 'utf8')));
console.log(`cases: ${total}  identical: ${total - mismatches.length}  different: ${mismatches.length}`);
for (const m of mismatches.slice(0, 200)) {
  console.log(`\n${m.amount}\n  vba : ${m.expected}\n  ours: ${m.actual}`);
}
process.exit(mismatches.length === 0 ? 0 : 1);
