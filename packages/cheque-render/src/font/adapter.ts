/**
 * A fontkit-shaped adapter over `ttf.ts`, so pdf-lib can embed a face and
 * subset it.
 *
 * Why this file exists: `pdf-lib` requires an object registered through
 * `PDFDocument.registerFontkit()` before `embedFont()` accepts custom bytes, and
 * it does not depend on `@pdf-lib/fontkit` (the usual provider). That package is
 * not installed here and this environment has no network access, so the package
 * supplies its own adapter. It implements the same interface pdf-lib uses, which
 * is small: `create(data)` plus the `Font` methods `layout`, `getGlyph`,
 * `glyphForCodePoint`, `createSubset`, and the metric properties read by
 * `CustomFontEmbedder`/`CustomFontSubsetEmbedder`.
 *
 * `layout()` here is deliberately *not* a shaper. Shaping is done by HarfBuzz
 * before pdf-lib sees the text (see `shape.ts`), so pdf-lib only needs a
 * one-to-one code point -> glyph mapping for the already-shaped characters.
 *
 * To use the real fontkit instead, replace the value passed to
 * `pdfDoc.registerFontkit` in `writer.ts` with `@pdf-lib/fontkit`.
 */
import { FontSubsetBuilder } from './subset.ts';
import { parseFont, type FontProgram } from './ttf.ts';

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface AdapterGlyph {
  readonly id: number;
  readonly codePoints: number[];
  readonly advanceWidth: number;
  readonly bbox: BoundingBox;
  readonly cbox: BoundingBox;
  readonly path: { toSVG(): string };
  readonly layers: unknown[];
  render(): void;
  getImageForSize(): Uint8Array;
}

export interface AdapterGlyphPosition {
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}

export interface AdapterGlyphRun {
  glyphs: AdapterGlyph[];
  positions: AdapterGlyphPosition[];
  script: string;
  language: null;
  direction: 'ltr' | 'rtl' | null;
  features: Record<string, boolean>;
  advanceWidth: number;
  advanceHeight: number;
  bbox: BoundingBox;
}

export interface AdapterSubsetStream {
  on(event: 'data' | 'end', callback: (data: Uint8Array) => unknown): AdapterSubsetStream;
}

export interface AdapterSubset {
  includeGlyph(glyph: number | AdapterGlyph): number;
  encodeStream(): AdapterSubsetStream;
}

export interface AdapterFont {
  postscriptName: string | null;
  fullName: string | null;
  familyName: string | null;
  subfamilyName: string | null;
  copyright: string | null;
  version: string | null;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  underlinePosition: number;
  underlineThickness: number;
  italicAngle: number;
  capHeight: number;
  xHeight: number;
  bbox: BoundingBox;
  numGlyphs: number;
  characterSet: number[];
  availableFeatures: string[];
  cff: unknown;
  'OS/2': { sFamilyClass: number };
  head: { macStyle: { italic: boolean } };
  post: { isFixedPitch: boolean };
  glyphForCodePoint(codePoint: number): AdapterGlyph;
  hasGlyphForCodePoint(codePoint: number): boolean;
  glyphsForString(text: string): AdapterGlyph[];
  widthOfGlyph(glyphId: number): number;
  layout(text: string, features?: unknown): AdapterGlyphRun;
  getGlyph(glyphId: number, codePoints?: number[]): AdapterGlyph;
  createSubset(): AdapterSubset;
}

export interface FontkitAdapter {
  create(data: Uint8Array, postscriptName?: string): AdapterFont;
}

function boxOf(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

class AdapterGlyphImpl implements AdapterGlyph {
  private readonly program: FontProgram;
  readonly id: number;
  private readonly forcedCodePoints: number[] | undefined;

  constructor(program: FontProgram, id: number, forcedCodePoints?: number[]) {
    this.program = program;
    this.id = id;
    this.forcedCodePoints = forcedCodePoints;
  }

  get codePoints(): number[] {
    return this.forcedCodePoints ?? [...this.program.codePointsForGlyph(this.id)];
  }

  get advanceWidth(): number {
    return this.program.advanceWidth(this.id);
  }

  get bbox(): BoundingBox {
    const metrics = this.program.glyphMetrics(this.id);
    if (!metrics) return boxOf(0, 0, 0, 0);
    return boxOf(metrics.xMin, metrics.yMin, metrics.xMax, metrics.yMax);
  }

  get cbox(): BoundingBox {
    return this.bbox;
  }

  get path(): { toSVG(): string } {
    return { toSVG: () => '' };
  }

  get layers(): unknown[] {
    return [];
  }

  render(): void {
    // pdf-lib addresses glyphs by id through Identity-H; outlines never need to
    // be replayed into a canvas from this adapter.
  }

  getImageForSize(): Uint8Array {
    return new Uint8Array(0);
  }
}

class AdapterFontImpl implements AdapterFont {
  private readonly program: FontProgram;
  private readonly glyphCache = new Map<number, AdapterGlyph>();

  constructor(program: FontProgram) {
    this.program = program;
  }

  get postscriptName(): string | null {
    return this.program.postscriptName;
  }

  get fullName(): string | null {
    return this.program.fullName;
  }

  get familyName(): string | null {
    return this.program.familyName;
  }

  get subfamilyName(): string | null {
    return this.program.subfamilyName;
  }

  get copyright(): string | null {
    return null;
  }

  get version(): string | null {
    return this.program.version;
  }

  get unitsPerEm(): number {
    return this.program.unitsPerEm;
  }

  get ascent(): number {
    return this.program.ascent;
  }

  get descent(): number {
    return this.program.descent;
  }

  get lineGap(): number {
    return this.program.lineGap;
  }

  get underlinePosition(): number {
    return this.program.underlinePosition;
  }

  get underlineThickness(): number {
    return this.program.underlineThickness;
  }

  get italicAngle(): number {
    return this.program.italicAngle;
  }

  get capHeight(): number {
    return this.program.capHeight;
  }

  get xHeight(): number {
    return this.program.xHeight;
  }

  get bbox(): BoundingBox {
    const { xMin, yMin, xMax, yMax } = this.program.bbox;
    return boxOf(xMin, yMin, xMax, yMax);
  }

  get numGlyphs(): number {
    return this.program.numGlyphs;
  }

  get characterSet(): number[] {
    return [...this.program.characterSet];
  }

  get availableFeatures(): string[] {
    return [];
  }

  get cff(): unknown {
    return undefined;
  }

  get 'OS/2'(): { sFamilyClass: number } {
    return { sFamilyClass: this.program.os2FamilyClass };
  }

  get head(): { macStyle: { italic: boolean } } {
    return { macStyle: { italic: this.program.macStyleItalic } };
  }

  get post(): { isFixedPitch: boolean } {
    return { isFixedPitch: this.program.isFixedPitch };
  }

  private glyphOf(glyphId: number, codePoints?: number[]): AdapterGlyph {
    if (codePoints && codePoints.length > 0) {
      // A glyph object must carry exactly the code points the caller addressed it
      // by. Reusing a cached object here would make pdf-lib's `/ToUnicode` CMap
      // claim the glyph stands for every code point it happens to map to.
      return new AdapterGlyphImpl(this.program, glyphId, [...codePoints]);
    }
    const cached = this.glyphCache.get(glyphId);
    if (cached) return cached;
    const glyph = new AdapterGlyphImpl(this.program, glyphId);
    this.glyphCache.set(glyphId, glyph);
    return glyph;
  }

  glyphForCodePoint(codePoint: number): AdapterGlyph {
    const glyphId = this.program.glyphIdForCodePoint(codePoint) ?? 0;
    return this.glyphOf(glyphId, [codePoint]);
  }

  hasGlyphForCodePoint(codePoint: number): boolean {
    return this.program.glyphIdForCodePoint(codePoint) !== undefined;
  }

  glyphsForString(text: string): AdapterGlyph[] {
    const glyphs: AdapterGlyph[] = [];
    for (const character of text) {
      const codePoint = character.codePointAt(0) ?? 0;
      glyphs.push(this.glyphForCodePoint(codePoint));
    }
    return glyphs;
  }

  widthOfGlyph(glyphId: number): number {
    return this.program.advanceWidth(glyphId);
  }

  layout(text: string): AdapterGlyphRun {
    const glyphs: AdapterGlyph[] = [];
    const positions: AdapterGlyphPosition[] = [];
    let advance = 0;
    for (const character of text) {
      const codePoint = character.codePointAt(0) ?? 0;
      const glyph = this.glyphForCodePoint(codePoint);
      glyphs.push(glyph);
      positions.push({ xAdvance: glyph.advanceWidth, yAdvance: 0, xOffset: -advance, yOffset: 0 });
      advance += glyph.advanceWidth;
    }
    const empty = boxOf(0, 0, 0, 0);
    return {
      glyphs,
      positions,
      script: 'Arab',
      language: null,
      direction: 'rtl',
      features: {},
      advanceWidth: advance,
      advanceHeight: 0,
      bbox: empty,
    };
  }

  getGlyph(glyphId: number, codePoints?: number[]): AdapterGlyph {
    return this.glyphOf(glyphId, codePoints);
  }

  createSubset(): AdapterSubset {
    const builder = new FontSubsetBuilder(this.program);
    return {
      includeGlyph: (glyph) => builder.include(typeof glyph === 'number' ? glyph : glyph.id),
      encodeStream: () => {
        const dataHandlers: ((data: Uint8Array) => unknown)[] = [];
        const endHandlers: ((data: Uint8Array) => unknown)[] = [];
        const stream: AdapterSubsetStream = {
          on: (event, callback) => {
            if (event === 'data') dataHandlers.push(callback);
            else endHandlers.push(callback);
            return stream;
          },
        };
        // pdf-lib subscribes to both events right after calling this method, so
        // encoding is deferred to the next task and every handler is registered.
        setTimeout(() => {
          const bytes = builder.build();
          for (const handler of dataHandlers) handler(bytes);
          for (const handler of endHandlers) handler(bytes);
        }, 0);
        return stream;
      },
    };
  }
}

export function createFontkitAdapter(): FontkitAdapter {
  return {
    create: (data: Uint8Array): AdapterFont => new AdapterFontImpl(parseFont(data)),
  };
}
