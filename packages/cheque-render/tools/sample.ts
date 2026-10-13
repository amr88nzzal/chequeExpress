// Writes a sample cheque PDF: node tools/sample.ts [out.pdf] [print|preview]
import { writeFile } from 'node:fs/promises';
import { ChequeRenderer, PLACEHOLDER_LAYOUT } from '../src/index.ts';

const out = process.argv[2] ?? 'sample-cheque.pdf';
const mode = process.argv[3] === 'preview' ? 'preview' : 'print';
const renderer = await ChequeRenderer.launch();
try {
  const pdf = await renderer.renderPdf({
    layout: PLACEHOLDER_LAYOUT,
    values: {
      date: '05/10/2026',
      payee: 'السادة شركة بوليفارد العبدلي المحترمين',
      words1: 'ثلاثة آلاف وثلاثمائة وخمسة وخمسون دينارا و 515 فلس فقط',
      amtMain: '3355',
      amtFrac: '515',
      memo: 'دفعة من الحساب 24/24',
    },
    options: { mode },
  });
  await writeFile(out, pdf);
  console.log(`wrote ${out} (${pdf.length} bytes, ${mode})`);
} finally {
  await renderer.close();
}
