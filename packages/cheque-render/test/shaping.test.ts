/**
 * Arabic shaping, joining and right-to-left ordering.
 *
 * Two layers are involved and both are asserted:
 *
 *   1. `applyArabicJoining` (ours) maps each letter to the presentation form its
 *      neighbours require. It runs first because this environment's HarfBuzz
 *      build only routes a font through its Arabic shaper when the font declares
 *      an `arab` script in `GSUB`, and it returns no scripts for a hand-built
 *      `GSUB` (measured; see `tools/opentype.ts` and the README).
 *   2. HarfBuzz shapes the resulting presentation forms: advances, and the
 *      right-to-left visual order.
 *
 * The fixture font spells both the base letters and the joined forms in its
 * `cmap`, so a renderer that skipped joining would put the BASE letters' glyphs
 * in the PDF. Every assertion below therefore fails if joining is skipped.
 */
import { applyArabicJoining, isJoiningLetter, joiningClassOf } from '../src/text/joining.ts';
import { shapeText } from '../src/text/shape.ts';
import { TEST_DATA, TEST_LAYOUT, testFontBytes, testFontProgram } from './fixtures.ts';
import { expectedGlyphCount, expectedVisualText } from './expected-positions.ts';
import { measureRuns, renderCase } from './helpers/render.ts';

const GID = {
  alefIsolated: 1,
  alefFinal: 2,
  lamIsolated: 3,
  lamInitial: 4,
  meemIsolated: 6,
  meemInitial: 7,
  meemFinal: 8,
  hahMedial: 10,
};

/** Source glyph ids for the *unjoined* spelling of a word, for contrast. */
function unjoinedGlyphIds(text: string): number[] {
  const program = testFontProgram();
  return [...text].map(
    (character) => program.glyphIdForCodePoint(character.codePointAt(0) ?? 0) ?? 0,
  );
}

function shape(text: string): { glyphIds: number[]; advanceUnits: number; joined: string } {
  const program = testFontProgram();
  const shaped = shapeText(
    text,
    { bytes: testFontBytes(), unitsPerEm: program.unitsPerEm, notdefGlyphIds: [0] },
    'rtl',
  );
  return {
    glyphIds: shaped.glyphs.map((glyph) => glyph.glyphId),
    advanceUnits: shaped.advanceUnits,
    joined: applyArabicJoining(text, 'rtl'),
  };
}

describe('Arabic joining', () => {
  it('gives a lam-alef pair the initial lam and final alef forms', () => {
    const shaped = shape('لا');
    // Visual left-to-right order: final alef then initial lam.
    expect(shaped.glyphIds).toEqual([GID.alefFinal, GID.lamInitial]);
    expect(shaped.advanceUnits).toBe(1000);
  });

  it('does not emit the isolated letters for a joined pair', () => {
    const shaped = shape('لا');
    const unjoined = unjoinedGlyphIds('لا');
    expect(unjoined).toEqual([GID.lamIsolated, GID.alefIsolated]);
    expect(shaped.glyphIds).not.toEqual(unjoined);
    expect(shaped.glyphIds).not.toEqual([...unjoined].reverse());
  });

  it('gives a four-letter word the initial, medial and final forms', () => {
    const shaped = shape('محمد');
    // final meem, medial hah, initial meem - three glyphs, not four.
    expect(shaped.glyphIds).toEqual([GID.meemFinal, GID.hahMedial, GID.meemInitial]);
    expect(shaped.advanceUnits).toBe(1500);
    const unjoined = unjoinedGlyphIds('محمد');
    expect(unjoined.length).toBe(4);
    expect(shaped.glyphIds).not.toEqual(unjoined);
  });

  it('classifies the letters it knows and leaves everything else alone', () => {
    expect(joiningClassOf(0x0644)).toBe('dual');
    expect(joiningClassOf(0x0627)).toBe('right');
    expect(joiningClassOf(0x0030)).toBe('none');
    expect(isJoiningLetter(0x0645)).toBe(true);
    expect(isJoiningLetter(0x0041)).toBe(false);
    // A left-to-right paragraph is never joined.
    expect(applyArabicJoining('لا', 'ltr')).toBe('لا');
  });
});

describe('shaped output', () => {
  it('produces the expected glyph count for every rendered field', async () => {
    const offset = { dxMm: 0, dyMm: 0 } as const;
    const rendered = await renderCase(TEST_LAYOUT, { ...offset, paperMode: 'custom' }, TEST_DATA);
    for (const row of measureRuns(rendered, TEST_LAYOUT, TEST_DATA, offset)) {
      expect(rendered.reader.runGlyphIds(row.run).length).toBe(expectedGlyphCount(row.fieldId));
      expect(row.decodedText).toBe(expectedVisualText(row.fieldId, TEST_DATA));
    }
  });

  it('stores the joined presentation forms in the PDF, not the isolated letters', async () => {
    const offset = { dxMm: 0, dyMm: 0 } as const;
    const rendered = await renderCase(TEST_LAYOUT, { ...offset, paperMode: 'custom' }, TEST_DATA);
    const expected = measureRuns(rendered, TEST_LAYOUT, TEST_DATA, offset).find(
      (row) => row.fieldId === 'payee',
    )!;
    // 'محمد' joined is meem-initial, hah-medial, meem-final; the visual order
    // (right to left) puts the final meem first.
    expect(rendered.reader.runGlyphIds(expected.run)).toEqual([
      GID.meemFinal,
      GID.hahMedial,
      GID.meemInitial,
    ]);
    expect(expected.decodedText).toBe('\uFEE2\u062D\uFEE3');
    expect(expected.decodedText).not.toBe(TEST_DATA.payee);
  });

  it('orders right-to-left text so it ends flush with the right edge of its box', async () => {
    const offset = { dxMm: 0, dyMm: 0 } as const;
    const rendered = await renderCase(TEST_LAYOUT, { ...offset, paperMode: 'custom' }, TEST_DATA);
    const payee = measureRuns(rendered, TEST_LAYOUT, TEST_DATA, offset).find(
      (row) => row.fieldId === 'payee',
    )!;
    const size = rendered.reader.pageSizeMm();
    const endMm = payee.startXMm + payee.widthMm;
    // The payee box is x 40..165 mm and right aligned.
    expect(Math.abs(endMm - 165)).toBeLessThanOrEqual(0.2);
    expect(endMm).toBeLessThan(size.widthMm);
  });
});
