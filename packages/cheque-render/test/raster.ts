import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';

export const DPI = 300;
export const PX_PER_MM = DPI / 25.4;

export const hasPoppler = (): boolean =>
  ['pdftoppm', 'pdfinfo', 'pdffonts'].every((b) => spawnSync(b, ['-v']).error === undefined);

export type Raster = { ink: Uint8Array; widthPx: number; heightPx: number };

const withTempPdf = <T>(pdf: Buffer, fn: (path: string, dir: string) => T): T => {
  const dir = mkdtempSync(join(tmpdir(), 'cheque-'));
  try {
    const path = join(dir, 'in.pdf');
    writeFileSync(path, pdf);
    return fn(path, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** Page size of the first page in millimetres. */
export const pdfPageSizeMm = (pdf: Buffer): { width: number; height: number } =>
  withTempPdf(pdf, (path) => {
    const out = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
    const m = /Page size:\s+([\d.]+) x ([\d.]+) pts/.exec(out);
    if (!m) throw new Error('pdfinfo: page size not found');
    return { width: (Number(m[1]) / 72) * 25.4, height: (Number(m[2]) / 72) * 25.4 };
  });

export const pdfFonts = (pdf: Buffer): string =>
  withTempPdf(pdf, (path) => execFileSync('pdffonts', [path], { encoding: 'utf8' }));

export const pdfPageCount = (pdf: Buffer): number =>
  withTempPdf(pdf, (path) => {
    const out = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
    return Number(/Pages:\s+(\d+)/.exec(out)?.[1]);
  });

/** Rasterises page 1 at 300 dpi; ink = dark pixel. */
export const rasterize = (pdf: Buffer): Raster =>
  withTempPdf(pdf, (path, dir) => {
    execFileSync('pdftoppm', [
      '-r',
      String(DPI),
      '-gray',
      '-png',
      '-singlefile',
      path,
      join(dir, 'out'),
    ]);
    const png = PNG.sync.read(readFileSync(join(dir, 'out.png')));
    const ink = new Uint8Array(png.width * png.height);
    for (let i = 0; i < ink.length; i++) ink[i] = (png.data[i * 4] ?? 255) < 128 ? 1 : 0;
    return { ink, widthPx: png.width, heightPx: png.height };
  });

export type BBox = { x0: number; y0: number; x1: number; y1: number };

/** Ink bounding box (mm) inside a window (mm); undefined when the window has no ink. */
export const inkBBox = (
  r: Raster,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): BBox | undefined => {
  const a = Math.max(0, Math.round(x0 * PX_PER_MM));
  const b = Math.max(0, Math.round(y0 * PX_PER_MM));
  const c = Math.min(r.widthPx, Math.round(x1 * PX_PER_MM));
  const d = Math.min(r.heightPx, Math.round(y1 * PX_PER_MM));
  let minX = Infinity,
    minY = Infinity,
    maxX = -1,
    maxY = -1;
  for (let y = b; y < d; y++) {
    for (let x = a; x < c; x++) {
      if (r.ink[y * r.widthPx + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return undefined;
  return {
    x0: minX / PX_PER_MM,
    y0: minY / PX_PER_MM,
    x1: (maxX + 1) / PX_PER_MM,
    y1: (maxY + 1) / PX_PER_MM,
  };
};

export const center = (b: BBox): { x: number; y: number } => ({
  x: (b.x0 + b.x1) / 2,
  y: (b.y0 + b.y1) / 2,
});
