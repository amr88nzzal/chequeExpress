/**
 * Page geometry: the produced PDF's `/MediaBox` must be exactly the requested
 * cheque size in millimetres, with no margins and no scaling.
 */
import { TEST_DATA, TEST_LAYOUT } from './fixtures.ts';
import { TOLERANCE_MM } from './expected-positions.ts';
import { renderCase } from './helpers/render.ts';

describe('page geometry', () => {
  it('writes a /MediaBox equal to the layout size in millimetres', async () => {
    const rendered = await renderCase(
      TEST_LAYOUT,
      { dxMm: 0, dyMm: 0, paperMode: 'custom' },
      TEST_DATA,
    );
    const size = rendered.reader.pageSizeMm();
    expect(Math.abs(size.widthMm - TEST_LAYOUT.widthMm)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs(size.heightMm - TEST_LAYOUT.heightMm)).toBeLessThanOrEqual(TOLERANCE_MM);

    const [xPt, yPt, widthPt, heightPt] = rendered.reader.mediaBoxPt();
    expect(xPt).toBe(0);
    expect(yPt).toBe(0);
    expect(Math.abs((widthPt * 25.4) / 72 - TEST_LAYOUT.widthMm)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs((heightPt * 25.4) / 72 - TEST_LAYOUT.heightMm)).toBeLessThanOrEqual(
      TOLERANCE_MM,
    );
  });

  it('produces exactly one page', async () => {
    const rendered = await renderCase(
      TEST_LAYOUT,
      { dxMm: 0, dyMm: 0, paperMode: 'custom' },
      TEST_DATA,
    );
    expect(rendered.reader.document.getPageCount()).toBe(1);
  });

  it('does not scale content when profile.scale is omitted', async () => {
    const withoutScale = await renderCase(
      TEST_LAYOUT,
      { dxMm: 0, dyMm: 0, paperMode: 'custom' },
      TEST_DATA,
    );
    const withScaleOne = await renderCase(
      TEST_LAYOUT,
      { dxMm: 0, dyMm: 0, paperMode: 'custom', scale: 1 },
      TEST_DATA,
    );
    expect(withoutScale.reader.contentStream()).toBe(withScaleOne.reader.contentStream());
  });

  it('keeps the cheque size on an A4 sheet and places the content at the origin', async () => {
    const rendered = await renderCase(
      TEST_LAYOUT,
      { dxMm: 0, dyMm: 0, paperMode: 'a4', originXMm: 15, originYMm: 20 },
      TEST_DATA,
    );
    const size = rendered.reader.pageSizeMm();
    expect(Math.abs(size.widthMm - 210)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs(size.heightMm - 297)).toBeLessThanOrEqual(TOLERANCE_MM);
    const dateRun = rendered.reader.findRun(TEST_DATA.issueDate);
    expect(Math.abs((dateRun.xPt * 25.4) / 72 - (15 + 12))).toBeLessThanOrEqual(TOLERANCE_MM);
  });
});
