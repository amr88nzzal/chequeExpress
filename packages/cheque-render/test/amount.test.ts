/**
 * The amount in figures and the amount in words come from the same source, the
 * closing phrase appears once, and both words lines are rendered.
 */
import { deriveAmountFigures } from '../src/index.ts';
import { applyArabicJoining } from '../src/text/joining.ts';
import { TEST_DATA, TEST_LAYOUT } from './fixtures.ts';
import { expectedVisualText } from './expected-positions.ts';
import { measureRuns, renderCase } from './helpers/render.ts';

const OFFSET = { dxMm: 0, dyMm: 0 } as const;
const PROFILE = { ...OFFSET, paperMode: 'custom' } as const;

describe('amount figures come from the amount in words', () => {
  it('derives both figures from the words lines, in order', () => {
    const figures = deriveAmountFigures(TEST_DATA);
    expect(figures.dinar).toBe('3355');
    expect(figures.fils).toBe('515');
    expect(figures.sourceLines[0]).toBe(TEST_DATA.amountWordsLine1);
    expect(figures.sourceLines[1]).toBe(TEST_DATA.amountWordsLine2);
    expect(figures.sourceText.slice(figures.sourceIndexOf.dinar)).toMatch(/^3355/);
    expect(figures.sourceText.slice(figures.sourceIndexOf.fils)).toMatch(/^515/);
  });

  it('prints in the figures cells exactly the digits found in the words', async () => {
    const rendered = await renderCase(TEST_LAYOUT, PROFILE, TEST_DATA);
    const measured = new Map(
      measureRuns(rendered, TEST_LAYOUT, TEST_DATA, OFFSET).map((row) => [row.fieldId, row]),
    );
    const figures = deriveAmountFigures(TEST_DATA);
    expect(measured.get('amountDinar')!.decodedText).toBe(figures.dinar);
    expect(measured.get('amountFils')!.decodedText).toBe(figures.fils);
    // The figures really are the digits that appear in the words lines.
    const words1 = expectedVisualText('amountWordsLine1', TEST_DATA);
    const words2 = expectedVisualText('amountWordsLine2', TEST_DATA);
    expect(words1.includes(figures.dinar)).toBe(true);
    expect(words2.includes(figures.fils)).toBe(true);
  });

  it('renders both amount-in-words lines exactly once', async () => {
    const rendered = await renderCase(TEST_LAYOUT, PROFILE, TEST_DATA);
    const measured = measureRuns(rendered, TEST_LAYOUT, TEST_DATA, OFFSET);
    const first = measured.find((row) => row.fieldId === 'amountWordsLine1')!;
    const second = measured.find((row) => row.fieldId === 'amountWordsLine2')!;
    expect(first.decodedText).toBe(expectedVisualText('amountWordsLine1', TEST_DATA));
    expect(second.decodedText).toBe(expectedVisualText('amountWordsLine2', TEST_DATA));
    expect(rendered.runs.length).toBe(TEST_LAYOUT.fields.length);
  });

  it('appends the closing phrase to the last words line exactly once', async () => {
    const rendered = await renderCase(TEST_LAYOUT, PROFILE, TEST_DATA);
    const measured = measureRuns(rendered, TEST_LAYOUT, TEST_DATA, OFFSET);
    const second = measured.find((row) => row.fieldId === 'amountWordsLine2')!;
    const expected = expectedVisualText('amountWordsLine2', TEST_DATA);
    expect(second.decodedText).toBe(expected);
    // The closing phrase is the tail of that line, and it is not a line of its
    // own anywhere in the document.
    const closingJoined = applyArabicJoining(TEST_DATA.closingPhrase, 'rtl');
    const expectedTail = expected.slice(-[...closingJoined].length);
    expect(second.decodedText.endsWith(expectedTail)).toBe(true);
    const others = rendered.runs
      .filter((run) => run !== second.run)
      .map((run) => rendered.reader.decodeRun(run));
    // No other field carries a line that ends with the closing phrase.
    expect(others.some((text) => text.endsWith(expectedTail))).toBe(false);
  });
});
