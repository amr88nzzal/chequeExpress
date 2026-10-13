import { embeddedFontCss, FONT_FAMILY } from './font.ts';
import { DEFAULT_PROFILE, type RenderInput } from './types.ts';

export const A4_LANDSCAPE_MM = { width: 297, height: 210 } as const;
export const MARK_SIZE_MM = 4;
export const MARK_INSET_MM = 5;

const esc = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const mm = (n: number): string => `${Number(n.toFixed(4))}mm`;

export const marksFor = (w: number, h: number): Array<[number, number]> => [
  [MARK_INSET_MM, MARK_INSET_MM],
  [w - MARK_INSET_MM, MARK_INSET_MM],
  [MARK_INSET_MM, h - MARK_INSET_MM],
  [w - MARK_INSET_MM, h - MARK_INSET_MM],
];

/** Size of the PDF page for an input: the cheque itself, or A4 landscape. */
export const pageSizeMm = (input: RenderInput): { width: number; height: number } => {
  const profile = input.profile ?? DEFAULT_PROFILE;
  return profile.paper.kind === 'a4'
    ? { ...A4_LANDSCAPE_MM }
    : { width: input.layout.widthMm, height: input.layout.heightMm };
};

const validate = (input: RenderInput): void => {
  const { layout } = input;
  const profile = input.profile ?? DEFAULT_PROFILE;
  const finite = (n: number): boolean => Number.isFinite(n);
  if (!(layout.widthMm > 0 && layout.heightMm > 0)) throw new Error('layout size must be positive');
  if (![profile.offsetXMm, profile.offsetYMm].every(finite))
    throw new Error('offset must be finite');
  if (!(profile.scale >= 0.5 && profile.scale <= 1.5))
    throw new Error('scale must be within 0.5..1.5');
  if (
    profile.paper.kind === 'a4' &&
    ![profile.paper.originXMm, profile.paper.originYMm].every(finite)
  ) {
    throw new Error('A4 origin must be finite');
  }
  const ids = new Set<string>();
  for (const f of layout.fields) {
    if (ids.has(f.id)) throw new Error(`duplicate field id: ${f.id}`);
    ids.add(f.id);
  }
};

/** Pure function: the complete HTML document for one cheque. */
export const buildChequeHtml = (input: RenderInput): string => {
  validate(input);
  const { layout, values } = input;
  const profile = input.profile ?? DEFAULT_PROFILE;
  const options = input.options ?? { mode: 'print' };
  const preview = options.mode === 'preview';
  const page = pageSizeMm(input);

  const origin =
    profile.paper.kind === 'a4'
      ? { x: profile.paper.originXMm, y: profile.paper.originYMm }
      : { x: 0, y: 0 };
  const sheetX = origin.x + profile.offsetXMm;
  const sheetY = origin.y + profile.offsetYMm;

  // The sheet sits inside a fixed-size overflow:hidden clip. Without it, a positive offset makes the content
  // overflow the page and Chromium silently shrinks the whole page to fit (found in the C0 spike).
  const css = `
${embeddedFontCss()}
@page { size: ${mm(page.width)} ${mm(page.height)}; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { width: ${mm(page.width)}; height: ${mm(page.height)}; overflow: hidden }
body { font-family: '${FONT_FAMILY}', serif; position: relative; color: #000 }
.clip { position: absolute; left: 0; top: 0; width: ${mm(page.width)}; height: ${mm(page.height)}; overflow: hidden }
.sheet { position: absolute; left: ${mm(sheetX)}; top: ${mm(sheetY)}; width: ${mm(layout.widthMm)}; height: ${mm(layout.heightMm)};
  transform: scale(${profile.scale}); transform-origin: 0 0 }
.f { position: absolute; white-space: nowrap; overflow: hidden }
.f.right { text-align: right } .f.left { text-align: left } .f.center { text-align: center }
.m { position: absolute; width: ${mm(MARK_SIZE_MM)}; height: ${mm(MARK_SIZE_MM)}; background: #000 }
.frame { position: absolute; outline: 0.2mm solid #888 }
.bg { position: absolute; left: 0; top: 0; width: ${mm(layout.widthMm)}; height: ${mm(layout.heightMm)}; opacity: 0.5 }
`;

  const parts: string[] = ['<div class="clip"><div class="sheet">'];
  if (preview && layout.backgroundDataUrl)
    parts.push(`<img class="bg" src="${esc(layout.backgroundDataUrl)}">`);
  if (options.registrationMarks) {
    for (const [cx, cy] of marksFor(layout.widthMm, layout.heightMm)) {
      parts.push(
        `<div class="m" style="left:${mm(cx - MARK_SIZE_MM / 2)};top:${mm(cy - MARK_SIZE_MM / 2)}"></div>`,
      );
    }
  }
  for (const f of layout.fields) {
    const box = `left:${mm(f.x)};top:${mm(f.y)};width:${mm(f.width)};height:${mm(f.height)}`;
    if (preview) parts.push(`<div class="frame" style="${box}"></div>`);
    const text = values[f.id] ?? '';
    parts.push(
      `<div class="f ${f.align}" dir="${f.dir ?? 'rtl'}" style="${box};line-height:${mm(f.height)};` +
        `font-size:${f.fontPt}pt;font-weight:${f.weight ?? 700}">${esc(text)}</div>`,
    );
  }
  parts.push('</div></div>');

  return `<!doctype html><html lang="ar"><head><meta charset="utf-8"><style>${css}</style></head><body>${parts.join('')}</body></html>`;
};
