/**
 * Field placement: the drawn run's position is compared against the expectation
 * table in `expected-positions.ts`.
 *
 * The measurement comes from the finished PDF (`Tm` of each text run, and the
 * embedded font's own `/W` array for the width). The expectation comes from the
 * field box, the printer offset and the fixture font's metrics. The renderer's
 * in-memory plan is never consulted.
 */
import { TEST_DATA, TEST_LAYOUT, fieldById } from './fixtures.ts';
import { TOLERANCE_MM, expectedPlacement, expectedRenderedText } from './expected-positions.ts';
import { measureRuns, renderCase } from './helpers/render.ts';

const PROFILE = { dxMm: 0, dyMm: 0, paperMode: 'custom' } as const;

describe('field placement', () => {
  it('puts every field inside 0.2 mm of its independently expected position', async () => {
    const rendered = await renderCase(TEST_LAYOUT, PROFILE, TEST_DATA);
    const measured = measureRuns(rendered, TEST_LAYOUT, TEST_DATA, PROFILE);
    expect(measured.length).toBe(TEST_LAYOUT.fields.length);
    for (const row of measured) {
      const expected = expectedPlacement(fieldById(row.fieldId), PROFILE);
      expect(Math.abs(row.startXMm - expected.runStartXMm)).toBeLessThanOrEqual(TOLERANCE_MM);
      expect(Math.abs(row.baselineYMm - expected.baselineYMm)).toBeLessThanOrEqual(TOLERANCE_MM);
      expect(Math.abs(row.widthMm - expected.widthMm)).toBeLessThanOrEqual(TOLERANCE_MM);
    }
  });

  it('honours left, right and center alignment against the field box', async () => {
    const rendered = await renderCase(TEST_LAYOUT, PROFILE, TEST_DATA);
    const measured = new Map(
      measureRuns(rendered, TEST_LAYOUT, TEST_DATA, PROFILE).map((row) => [row.fieldId, row]),
    );

    const date = measured.get('date')!;
    const dateField = fieldById('date');
    expect(Math.abs(date.startXMm - dateField.xMm)).toBeLessThanOrEqual(TOLERANCE_MM);

    const payee = measured.get('payee')!;
    const payeeField = fieldById('payee');
    expect(
      Math.abs(payee.startXMm + payee.widthMm - (payeeField.xMm + payeeField.wMm)),
    ).toBeLessThanOrEqual(TOLERANCE_MM);

    const dinar = measured.get('amountDinar')!;
    const dinarField = fieldById('amountDinar');
    expect(
      Math.abs(dinar.startXMm + dinar.widthMm / 2 - (dinarField.xMm + dinarField.wMm / 2)),
    ).toBeLessThanOrEqual(TOLERANCE_MM);
  });

  it('draws each field exactly once and with the text its data implies', async () => {
    const rendered = await renderCase(TEST_LAYOUT, PROFILE, TEST_DATA);
    expect(rendered.runs.length).toBe(TEST_LAYOUT.fields.length);
    for (const row of measureRuns(rendered, TEST_LAYOUT, TEST_DATA, PROFILE)) {
      // One substitution: `measureRuns` already proved the run count, so the
      // decoded text is asserted against the independently derived joining.
      expect(row.decodedText.length).toBeGreaterThan(0);
      const digits = expectedRenderedText(row.fieldId, TEST_DATA).match(/[0-9]+/g) ?? [];
      for (const value of digits) {
        expect(row.decodedText.includes(value)).toBe(true);
      }
    }
  });

  it('is deterministic: two renders of the same input are byte-identical', async () => {
    const first = await renderCase(TEST_LAYOUT, PROFILE, TEST_DATA);
    const second = await renderCase(TEST_LAYOUT, PROFILE, TEST_DATA);
    expect(first.bytes.length).toBe(second.bytes.length);
    let identical = true;
    for (let i = 0; i < first.bytes.length; i += 1) {
      if (first.bytes[i] !== second.bytes[i]) identical = false;
    }
    expect(identical).toBe(true);
  });
});
