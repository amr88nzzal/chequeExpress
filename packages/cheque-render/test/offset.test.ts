/**
 * Printer offsets, and the scale-detection check.
 *
 * The scale check is the important one: it measures the distance between two
 * FAR-APART reference fields. The previous Python spike only checked points near
 * the anchor, which cannot detect a silent shrink-to-fit. A renderer that scaled
 * content down would move the two references closer together and fail here even
 * though each point still "looked" plausible.
 */
import { TEST_DATA, TEST_LAYOUT, fieldById } from './fixtures.ts';
import { TOLERANCE_MM, expectedPlacement } from './expected-positions.ts';
import { measureRuns, renderCase } from './helpers/render.ts';

const OFFSETS: readonly { readonly dxMm: number; readonly dyMm: number }[] = [
  { dxMm: 0, dyMm: 0 },
  { dxMm: 1.5, dyMm: 0 },
  { dxMm: 0, dyMm: -0.8 },
  { dxMm: 1.5, dyMm: -0.8 },
];

describe('printer offset', () => {
  for (const offset of OFFSETS) {
    it(`shifts every field by exactly (${offset.dxMm}, ${offset.dyMm}) mm`, async () => {
      const rendered = await renderCase(TEST_LAYOUT, { ...offset, paperMode: 'custom' }, TEST_DATA);
      const measured = measureRuns(rendered, TEST_LAYOUT, TEST_DATA, offset);
      expect(measured.length).toBe(TEST_LAYOUT.fields.length);
      for (const row of measured) {
        const expected = expectedPlacement(fieldById(row.fieldId), offset);
        expect(Math.abs(row.startXMm - expected.runStartXMm)).toBeLessThanOrEqual(TOLERANCE_MM);
        expect(Math.abs(row.baselineYMm - expected.baselineYMm)).toBeLessThanOrEqual(TOLERANCE_MM);
      }
    });
  }

  it('keeps far-apart reference distances within 0.2 mm in every offset case', async () => {
    // The date field sits at x = 12 mm and the fils cell at x = 155 mm: about
    // 146 mm apart. Any silent scale would show up here, and neither the offset
    // nor a shrink-to-fit can change the distance between two reference runs.
    const referenceIds = ['date', 'amountFils'] as const;
    let firstDistance: number | undefined;

    for (const offset of OFFSETS) {
      const rendered = await renderCase(TEST_LAYOUT, { ...offset, paperMode: 'custom' }, TEST_DATA);
      const measured = new Map(
        measureRuns(rendered, TEST_LAYOUT, TEST_DATA, offset).map((row) => [row.fieldId, row]),
      );
      const first = measured.get(referenceIds[0])!;
      const second = measured.get(referenceIds[1])!;
      const distance = second.startXMm - first.startXMm;
      firstDistance ??= distance;
      expect(Math.abs(distance - firstDistance)).toBeLessThanOrEqual(TOLERANCE_MM);
      // The distance must also match the layout's own geometry, plus the
      // difference in how each run sits inside its box.
      const firstField = fieldById(referenceIds[0]);
      const secondField = fieldById(referenceIds[1]);
      const boxDistance = secondField.xMm - firstField.xMm;
      expect(Math.abs(distance - boxDistance)).toBeLessThan(20);
    }
  });

  it('does not move the page when the offset pushes content off the edge', async () => {
    const rendered = await renderCase(
      TEST_LAYOUT,
      { dxMm: 20, dyMm: 20, paperMode: 'custom' },
      TEST_DATA,
    );
    const size = rendered.reader.pageSizeMm();
    expect(Math.abs(size.widthMm - TEST_LAYOUT.widthMm)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs(size.heightMm - TEST_LAYOUT.heightMm)).toBeLessThanOrEqual(TOLERANCE_MM);
  });
});
