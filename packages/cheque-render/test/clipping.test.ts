/**
 * Clipping: content that the printer offset pushes past the page edge must be
 * cut off at the edge, and must never change the page size.
 *
 * This is the exact failure that was observed with Chromium in the C0 spike: an
 * overflowing element made the whole page shrink silently. Here the page size is
 * written from the layout, so both halves of the rule are asserted.
 */
import type { ChequeLayout, Field } from '../src/types.ts';
import { TEST_DATA, TEST_LAYOUT } from './fixtures.ts';
import { TOLERANCE_MM } from './expected-positions.ts';
import { mmFromPt, renderCase } from './helpers/render.ts';

/**
 * The test layout plus a "amountFils" cell deliberately placed so its centred
 * run straddles the right edge: box 174..178 mm, digits 4.2 mm wide, so the run
 * starts inside the page and ends outside it.
 */
const CLIPPING_LAYOUT: ChequeLayout = {
  widthMm: 175,
  heightMm: 93,
  fields: [
    ...TEST_LAYOUT.fields.filter((field: Field) => field.id !== 'amountFils'),
    {
      id: 'amountFils',
      xMm: 174,
      yMm: 80,
      wMm: 4,
      hMm: 8,
      align: 'center',
      fontPt: 10,
      lineHeightMm: 8,
    },
  ],
};

function measuredRuns(
  rendered: Awaited<ReturnType<typeof renderCase>>,
): { startMm: number; endMm: number; clipped: boolean }[] {
  return rendered.runs.map((run) => {
    const startMm = mmFromPt(run.xPt);
    return {
      startMm,
      endMm: startMm + mmFromPt(rendered.reader.runAdvancePt(run)),
      clipped: run.clipped,
    };
  });
}

describe('clipping at the page edge', () => {
  it('keeps the page size when content overflows the page', async () => {
    const rendered = await renderCase(
      CLIPPING_LAYOUT,
      { dxMm: 8, dyMm: 0, paperMode: 'custom' },
      TEST_DATA,
    );
    const size = rendered.reader.pageSizeMm();
    expect(Math.abs(size.widthMm - 175)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs(size.heightMm - 93)).toBeLessThanOrEqual(TOLERANCE_MM);
  });

  it('keeps the page size when the offset is huge', async () => {
    const rendered = await renderCase(
      CLIPPING_LAYOUT,
      { dxMm: 400, dyMm: -400, paperMode: 'custom' },
      TEST_DATA,
    );
    const size = rendered.reader.pageSizeMm();
    expect(Math.abs(size.widthMm - 175)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs(size.heightMm - 93)).toBeLessThanOrEqual(TOLERANCE_MM);
    for (const run of rendered.runs) {
      const baselineMm = size.heightMm - mmFromPt(run.yPt);
      expect(baselineMm > 0 && baselineMm < size.heightMm).toBe(false);
    }
  });

  it('marks a run that crosses the right edge as clipped', async () => {
    const rendered = await renderCase(
      CLIPPING_LAYOUT,
      { dxMm: 0, dyMm: 0, paperMode: 'custom' },
      TEST_DATA,
    );
    const size = rendered.reader.pageSizeMm();
    const overflowing = measuredRuns(rendered).filter((run) => run.endMm > size.widthMm + 1e-9);
    expect(overflowing.length).toBeGreaterThan(0);
    for (const run of overflowing) {
      expect(run.clipped).toBe(true);
    }
  });

  it('never places a run that starts beyond the right edge', async () => {
    const rendered = await renderCase(
      CLIPPING_LAYOUT,
      { dxMm: 8, dyMm: 0, paperMode: 'custom' },
      TEST_DATA,
    );
    const size = rendered.reader.pageSizeMm();
    for (const run of measuredRuns(rendered)) {
      expect(run.startMm).toBeLessThan(size.widthMm + TOLERANCE_MM);
    }
  });

  it('keeps the page size and draws nothing when the offset moves every field off the page', async () => {
    const rendered = await renderCase(
      TEST_LAYOUT,
      { dxMm: 0, dyMm: -200, paperMode: 'custom' },
      TEST_DATA,
    );
    const size = rendered.reader.pageSizeMm();
    expect(Math.abs(size.heightMm - TEST_LAYOUT.heightMm)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs(size.widthMm - TEST_LAYOUT.widthMm)).toBeLessThanOrEqual(TOLERANCE_MM);
    // Every run either vanished or was placed wholly outside the page.
    for (const run of rendered.runs) {
      const startMm = mmFromPt(run.xPt);
      const baselineMm = size.heightMm - mmFromPt(run.yPt);
      expect(baselineMm > 0 && baselineMm < size.heightMm && startMm >= 0).toBe(false);
    }
  });
});
