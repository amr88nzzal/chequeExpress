/**
 * Text -> shaped, ordered glyphs.
 *
 * Pipeline: `bidi-js` computes the Unicode bidi embedding levels, the string is
 * split into same-direction runs, and HarfBuzz (`harfbuzzjs`, a WASM build of
 * HarfBuzz 14.x) shapes each run into glyph ids, cluster indices and advances.
 *
 * ## Ordering
 *
 * Every list produced here is in LEFT-TO-RIGHT VISUAL order, which is the order
 * the caller draws in. The Unicode algorithm is applied the standard way: the
 * embedding levels are resolved, each maximal same-level run is reversed when
 * its level is odd, and the runs are then concatenated in logical order. This
 * handles pure Arabic and mixed Arabic/digit text with the same code path.
 *
 * ## Units
 *
 * This module deliberately works in FONT UNITS. Converting to millimetres needs
 * the field's point size, which is a layout concern, so `placeGlyphs` in
 * `layout.ts` does that conversion. Keeping the split also keeps this module a
 * pure function with no per-call state.
 */
import bidiFactory from 'bidi-js';
import * as harfbuzz from 'harfbuzzjs';
import { ShapingError } from '../errors.ts';
import { applyArabicJoining } from './joining.ts';
import type { TextDir } from '../types.ts';

/**
 * `bidi-js` ships CommonJS at runtime and a `bidi.d.ts` whose only export is a
 * default factory. Under NodeNext the two do not line up, so the factory is
 * named explicitly here.
 */
interface BidiEngine {
  getEmbeddingLevels(text: string, explicitDirection?: 'ltr' | 'rtl'): { levels: Uint8Array };
}

const bidiFactoryFn = bidiFactory as unknown as () => BidiEngine;
const bidi: BidiEngine = bidiFactoryFn();

/** One shaped glyph in font units, in visual order. */
export interface ShapedGlyph {
  /** Glyph id in the source font. */
  readonly glyphId: number;
  /** Index of the source character this glyph came from. */
  readonly cluster: number;
  /** Horizontal advance in font units; always positive. */
  readonly advanceUnits: number;
  /** Horizontal offset from the pen in font units. */
  readonly xOffsetUnits: number;
  /** Vertical offset from the baseline in font units (pen y is up). */
  readonly yOffsetUnits: number;
  /** Direction of the bidi run this glyph belongs to. */
  readonly runDir: TextDir;
}

export interface ShapedText {
  /** Glyphs in left-to-right visual order. */
  readonly glyphs: readonly ShapedGlyph[];
  /** Total advance in font units. */
  readonly advanceUnits: number;
  /** Resolved base direction of the paragraph. */
  readonly dir: TextDir;
  /** Bidi embedding levels, one per UTF-16 code unit of the input. */
  readonly levels: readonly number[];
}

/** The font metrics this module needs. */
export interface TextFont {
  readonly bytes: Uint8Array;
  readonly unitsPerEm: number;
  /** Ids treated as "no glyph" (`.notdef`); they are dropped from the output. */
  readonly notdefGlyphIds: readonly number[];
}

interface HbFontHandle {
  setScale(xScale: number, yScale: number): void;
}

interface HbBufferHandle {
  addText(text: string): void;
  setDirection(dir: number): void;
  guessSegmentProperties(): void;
}

interface HbModule {
  Blob: new (data: Uint8Array) => unknown;
  Face: new (blob: unknown) => unknown;
  Font: new (face: unknown) => HbFontHandle;
  Buffer: new () => HbBufferHandle;
  shape: (font: unknown, buffer: unknown) => void;
  Direction: { readonly LTR: number; readonly RTL: number };
}

interface FontHandle {
  readonly handle: HbFontHandle;
  readonly module: HbModule;
}

/**
 * HarfBuzz's WASM module is a process-wide singleton created when the package
 * is imported. Only the parsed *face* is memoised, keyed by the font bytes, and
 * the value is immutable, so reuse cannot leak state between renders.
 */
const faceCache = new Map<string, FontHandle>();

function fontKey(bytes: Uint8Array): string {
  return `${bytes.length}:${bytes[0] ?? 0}:${bytes[1] ?? 0}:${bytes[bytes.length - 1] ?? 0}`;
}

function harfbuzzFont(font: TextFont): FontHandle {
  const key = fontKey(font.bytes);
  const cached = faceCache.get(key);
  if (cached) return cached;
  const module = harfbuzz as unknown as HbModule;
  const blob = new module.Blob(font.bytes);
  const face = new module.Face(blob);
  const handle = new module.Font(face);
  handle.setScale(font.unitsPerEm, font.unitsPerEm);
  const entry: FontHandle = { handle, module };
  faceCache.set(key, entry);
  return entry;
}

interface Run {
  readonly start: number;
  readonly end: number; // exclusive
  readonly dir: TextDir;
}

function splitRuns(levels: Uint8Array, length: number, baseLevel: number): Run[] {
  const runs: Run[] = [];
  let index = 0;
  while (index < length) {
    const odd = ((levels[index] ?? baseLevel) & 1) === 1;
    let end = index;
    while (end + 1 < length && (((levels[end + 1] ?? baseLevel) & 1) === 1) === odd) end += 1;
    runs.push({ start: index, end: end + 1, dir: odd ? 'rtl' : 'ltr' });
    index = end + 1;
  }
  return runs;
}

/**
 * Shapes `text`, returning glyphs in left-to-right visual order.
 *
 * Arabic letters are joined first (`joining.ts`) because this environment's
 * HarfBuzz build does not route a font without an `arab` script in `GSUB`
 * through its Arabic shaper. Every replacement is one code point for one code
 * point, so cluster indices still refer to the caller's own string.
 *
 * Glyphs that resolve to `.notdef` are dropped, so a font that is missing a
 * joining form produces a visible gap instead of a row of empty boxes.
 */
export function shapeText(text: string, font: TextFont, dir: TextDir = 'rtl'): ShapedText {
  if (text.length === 0) {
    return { glyphs: [], advanceUnits: 0, dir, levels: [] };
  }
  const joined = applyArabicJoining(text, dir);
  const resolved = bidi.getEmbeddingLevels(joined, dir);
  const levels = resolved.levels;
  const runs = splitRuns(levels, joined.length, dir === 'rtl' ? 1 : 0);
  const characters = [...joined];

  /** Slot per source character; a slot may hold several glyphs (ligatures). */
  const slots: ShapedGlyph[][] = characters.map(() => []);
  const { handle, module } = harfbuzzFont(font);

  for (const run of runs) {
    const runText = characters.slice(run.start, run.end).join('');
    const buffer = new module.Buffer();
    buffer.addText(runText);
    buffer.setDirection(run.dir === 'rtl' ? module.Direction.RTL : module.Direction.LTR);
    buffer.guessSegmentProperties();
    try {
      module.shape(handle, buffer);
    } catch (error) {
      throw new ShapingError(
        `HarfBuzz failed to shape ${JSON.stringify(runText)}: ${(error as Error).message}`,
        `run@${run.start}`,
      );
    }
    const infos = (
      buffer as unknown as { getGlyphInfos(): { codepoint: number; cluster: number }[] }
    ).getGlyphInfos();
    const positions = (
      buffer as unknown as {
        getGlyphPositions(): { xAdvance: number; xOffset: number; yOffset: number }[];
      }
    ).getGlyphPositions();
    for (let i = 0; i < infos.length; i += 1) {
      const info = infos[i]!;
      const position = positions[i]!;
      if (font.notdefGlyphIds.includes(info.codepoint)) continue;
      const cluster = run.start + info.cluster;
      const slot = slots[cluster];
      if (!slot) continue;
      slot.push({
        glyphId: info.codepoint,
        cluster,
        advanceUnits: Math.abs(position.xAdvance),
        xOffsetUnits: position.xOffset,
        yOffsetUnits: position.yOffset,
        runDir: run.dir,
      });
    }
  }

  // Reverse the glyphs inside every odd-level run. Runs are already in logical
  // order, so the concatenation is the visual order.
  const runByCharacter: TextDir[] = new Array(characters.length).fill('ltr');
  for (const run of runs) {
    for (let i = run.start; i < run.end; i += 1) runByCharacter[i] = run.dir;
  }
  const runStartFor = (characterIndex: number): number => {
    for (const run of runs) {
      if (characterIndex >= run.start && characterIndex < run.end) return run.start;
    }
    return 0;
  };

  const glyphs: ShapedGlyph[] = [];
  let advanceUnits = 0;
  for (let characterIndex = 0; characterIndex < characters.length;) {
    const runDir = runByCharacter[characterIndex] ?? 'ltr';
    const runStart = runStartFor(characterIndex);
    let runEnd = characterIndex;
    while (runEnd < characters.length && (runByCharacter[runEnd] ?? 'ltr') === runDir) runEnd += 1;
    const runGlyphs: ShapedGlyph[] = [];
    for (let i = runStart; i < runEnd; i += 1) runGlyphs.push(...(slots[i] ?? []));
    const ordered = runDir === 'rtl' ? runGlyphs.reverse() : runGlyphs;
    for (const glyph of ordered) {
      glyphs.push(glyph);
      advanceUnits += glyph.advanceUnits;
    }
    characterIndex = runEnd;
  }

  return { glyphs, advanceUnits, dir: dir, levels: [...levels] };
}

/** Total advance of a shaped list, in font units. */
export function advanceOf(glyphs: readonly ShapedGlyph[]): number {
  let total = 0;
  for (const glyph of glyphs) total += glyph.advanceUnits;
  return total;
}
