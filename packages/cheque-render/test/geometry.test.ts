import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ChequeRenderer,
  DEFAULT_PROFILE,
  MARK_SIZE_MM,
  PLACEHOLDER_LAYOUT,
  marksFor,
  type PrinterProfile,
  type RenderInput,
} from '../src/index.ts';
import {
  center,
  hasPoppler,
  inkBBox,
  pdfFonts,
  pdfPageCount,
  pdfPageSizeMm,
  rasterize,
} from './raster.ts';

const L = PLACEHOLDER_LAYOUT;
const TOL = 0.2; // mm, the acceptance tolerance
const PAGE_TOL = 0.3; // Chromium rounds the page to whole CSS pixels (about 0.26 mm)

// Output of @cheques/words for 3355.515 JOD (the renderer receives already formatted text).
const words = 'ثلاثة آلاف وثلاثمائة وخمسة وخمسون دينارا و 515 فلس فقط';
const values = {
  date: '05/10/2026',
  payee: 'السادة شركة بوليفارد العبدلي المحترمين',
  words1: words,
  words2: '',
  amtMain: '3355',
  amtFrac: '515',
  memo: 'دفعة من الحساب 24/24',
};

const make = (profile?: Partial<PrinterProfile>): RenderInput => ({
  layout: L,
  values,
  profile: { ...DEFAULT_PROFILE, ...profile },
  options: { mode: 'print', registrationMarks: true },
});

// On a developer machine without poppler the suite is skipped; CI must have it.
const run = hasPoppler() || process.env['CI'] ? describe : describe.skip;

let renderer: ChequeRenderer;
beforeAll(async () => {
  renderer = await ChequeRenderer.launch();
});
afterAll(async () => {
  await renderer?.close();
});

run('cheque PDF geometry (300 dpi raster, mm)', () => {
  it('page size equals the cheque size (custom paper)', async () => {
    const pdf = await renderer.renderPdf(make());
    const size = pdfPageSizeMm(pdf);
    expect(Math.abs(size.width - L.widthMm)).toBeLessThanOrEqual(PAGE_TOL);
    expect(Math.abs(size.height - L.heightMm)).toBeLessThanOrEqual(PAGE_TOL);
    expect(pdfPageCount(pdf)).toBe(1);
  });

  it('registration marks land on their exact positions (zero offset)', async () => {
    const r = rasterize(await renderer.renderPdf(make()));
    for (const [cx, cy] of marksFor(L.widthMm, L.heightMm)) {
      const bb = inkBBox(r, cx - 4, cy - 4, cx + 4, cy + 4)!;
      expect(bb, `mark ${cx},${cy}`).toBeDefined();
      expect(Math.abs(center(bb).x - cx)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(center(bb).y - cy)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(bb.x1 - bb.x0 - MARK_SIZE_MM)).toBeLessThanOrEqual(TOL);
    }
  });

  it('non-zero printer offset moves every mark by exactly (dx, dy)', async () => {
    const dx = 1.5;
    const dy = -0.8;
    const r = rasterize(await renderer.renderPdf(make({ offsetXMm: dx, offsetYMm: dy })));
    for (const [cx, cy] of marksFor(L.widthMm, L.heightMm)) {
      const bb = inkBBox(r, cx + dx - 4, cy + dy - 4, cx + dx + 4, cy + dy + 4)!;
      expect(bb, `mark ${cx},${cy}`).toBeDefined();
      expect(Math.abs(center(bb).x - (cx + dx))).toBeLessThanOrEqual(TOL);
      expect(Math.abs(center(bb).y - (cy + dy))).toBeLessThanOrEqual(TOL);
    }
  });

  it('offset that pushes content past the page edge does NOT shrink the page (C0 spike pitfall)', async () => {
    const dx = 6;
    const dy = -3; // right marks fall outside the page; left marks stay visible
    const r = rasterize(await renderer.renderPdf(make({ offsetXMm: dx, offsetYMm: dy })));
    const [tl, , bl] = marksFor(L.widthMm, L.heightMm);
    const top = inkBBox(r, tl![0] + dx - 4, tl![1] + dy - 4, tl![0] + dx + 4, tl![1] + dy + 4)!;
    const bottom = inkBBox(r, bl![0] + dx - 4, bl![1] + dy - 4, bl![0] + dx + 4, bl![1] + dy + 4)!;
    expect(Math.abs(center(top).x - (tl![0] + dx))).toBeLessThanOrEqual(TOL);
    expect(Math.abs(center(top).y - (tl![1] + dy))).toBeLessThanOrEqual(TOL);
    // a silent shrink would make this distance about 0.8% (0.6 mm) smaller than 83 mm
    expect(Math.abs(center(bottom).y - center(top).y - (bl![1] - tl![1]))).toBeLessThanOrEqual(TOL);
    const size = pdfPageSizeMm(await renderer.renderPdf(make({ offsetXMm: dx, offsetYMm: dy })));
    expect(Math.abs(size.width - L.widthMm)).toBeLessThanOrEqual(PAGE_TOL);
  });

  it('A4 mode: page is A4 landscape and the cheque sits at the profile origin plus offset', async () => {
    const ox = 20;
    const oy = 30;
    const dx = 0.7;
    const dy = 0.4;
    const pdf = await renderer.renderPdf(
      make({ paper: { kind: 'a4', originXMm: ox, originYMm: oy }, offsetXMm: dx, offsetYMm: dy }),
    );
    const size = pdfPageSizeMm(pdf);
    expect(Math.abs(size.width - 297)).toBeLessThanOrEqual(PAGE_TOL);
    expect(Math.abs(size.height - 210)).toBeLessThanOrEqual(PAGE_TOL);
    const r = rasterize(pdf);
    for (const [cx, cy] of marksFor(L.widthMm, L.heightMm)) {
      const ex = ox + dx + cx;
      const ey = oy + dy + cy;
      const bb = inkBBox(r, ex - 4, ey - 4, ex + 4, ey + 4)!;
      expect(Math.abs(center(bb).x - ex)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(center(bb).y - ey)).toBeLessThanOrEqual(TOL);
    }
  });

  it('every text field has ink inside its box and honours its alignment', async () => {
    const r = rasterize(await renderer.renderPdf({ ...make(), options: { mode: 'print' } }));
    for (const f of L.fields) {
      if (!values[f.id as keyof typeof values]) continue;
      const bb = inkBBox(r, f.x - 0.8, f.y - 0.8, f.x + f.width + 0.8, f.y + f.height + 0.8);
      expect(bb, `${f.id} has ink`).toBeDefined();
      expect(bb!.x0, `${f.id} left`).toBeGreaterThanOrEqual(f.x - 0.3);
      expect(bb!.x1, `${f.id} right`).toBeLessThanOrEqual(f.x + f.width + 0.3);
      expect(bb!.y0, `${f.id} top`).toBeGreaterThanOrEqual(f.y - 0.3);
      expect(bb!.y1, `${f.id} bottom`).toBeLessThanOrEqual(f.y + f.height + 0.3);
      const edge =
        f.align === 'right'
          ? f.x + f.width - bb!.x1
          : f.align === 'left'
            ? bb!.x0 - f.x
            : (bb!.x0 + bb!.x1) / 2 - (f.x + f.width / 2);
      expect(Math.abs(edge), `${f.id} ${f.align}`).toBeLessThanOrEqual(1.5);
    }
  });

  it('print mode is text only: nothing outside the field boxes when marks are off', async () => {
    const r = rasterize(await renderer.renderPdf({ ...make(), options: { mode: 'print' } }));
    const all = inkBBox(r, 0, 0, L.widthMm, L.heightMm)!;
    const minX = Math.min(...L.fields.map((f) => f.x));
    const maxX = Math.max(...L.fields.map((f) => f.x + f.width));
    const minY = Math.min(...L.fields.map((f) => f.y));
    const maxY = Math.max(...L.fields.map((f) => f.y + f.height));
    expect(all.x0).toBeGreaterThanOrEqual(minX - 0.3);
    expect(all.x1).toBeLessThanOrEqual(maxX + 0.3);
    expect(all.y0).toBeGreaterThanOrEqual(minY - 0.3);
    expect(all.y1).toBeLessThanOrEqual(maxY + 0.3);
  });

  it('embeds Noto Naskh Arabic (no dependency on server fonts)', async () => {
    const fonts = pdfFonts(await renderer.renderPdf(make()));
    expect(fonts).toMatch(/NotoNaskhArabic/);
    const embedded = fonts.split('\n').filter((l) => /NotoNaskhArabic/.test(l));
    expect(embedded.length).toBeGreaterThan(0);
    for (const line of embedded) expect(line).toMatch(/\byes\s+yes\s+yes\b/);
  });
});
