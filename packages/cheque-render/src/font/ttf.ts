/**
 * A small TrueType parser, sufficient to embed a face in a PDF without pulling
 * in `@pdf-lib/fontkit` (not available in this build environment - see README).
 *
 * It reads `head`, `hhea`, `hmtx`, `maxp`, `post`, `name`, `OS/2`, `cmap`,
 * `loca` and `glyf`, which is exactly what pdf-lib's `CustomFontEmbedder` and
 * `CustomFontSubsetEmbedder` ask a font object for.
 */
import { ShapingError } from '../errors.ts';

/** Table tags as 32-bit integers, so the directory can be a `Map<number, ...>`. */
function tagToInt(tagText: string): number {
  return (
    ((tagText.charCodeAt(0) << 24) |
      (tagText.charCodeAt(1) << 16) |
      (tagText.charCodeAt(2) << 8) |
      tagText.charCodeAt(3)) >>>
    0
  );
}

const HEAD = tagToInt('head');
const HHEA = tagToInt('hhea');
const MAXP = tagToInt('maxp');
const HMTX = tagToInt('hmtx');
const LOCA = tagToInt('loca');
const GLYF = tagToInt('glyf');
const CMAP = tagToInt('cmap');
const NAME = tagToInt('name');
const POST = tagToInt('post');
const OS2 = tagToInt('OS/2');

const MAC_ROMAN = 1;
const WINDOWS_UNICODE_BMP = 3;
const WINDOWS_UNICODE_FULL = 10;

export interface GlyphMetrics {
  readonly xMin: number;
  readonly yMin: number;
  readonly xMax: number;
  readonly yMax: number;
}

/** A parsed outline: a list of point runs, each with its own contour count. */
export interface GlyphOutline {
  readonly endPoints: readonly number[];
  readonly points: readonly { readonly x: number; readonly y: number; readonly onCurve: boolean }[];
}

export interface GlyphData {
  /** Glyph id in the source font. */
  readonly id: number;
  readonly advanceWidth: number;
  readonly codePoints: readonly number[];
  /** Empty for glyphs with no outline (for example the space glyph). */
  readonly outline: GlyphOutline | undefined;
}

export interface FontProgram {
  readonly unitsPerEm: number;
  readonly numGlyphs: number;
  readonly bbox: GlyphMetrics;
  readonly ascent: number;
  readonly descent: number;
  readonly lineGap: number;
  readonly capHeight: number;
  readonly xHeight: number;
  readonly italicAngle: number;
  readonly underlinePosition: number;
  readonly underlineThickness: number;
  readonly postscriptName: string | null;
  readonly familyName: string | null;
  readonly subfamilyName: string | null;
  readonly fullName: string | null;
  readonly version: string | null;
  readonly isFixedPitch: boolean;
  readonly macStyleItalic: boolean;
  readonly os2FamilyClass: number;
  readonly hasOs2: boolean;
  /** Every code point of the best `cmap` subtable, in ascending order. */
  readonly characterSet: readonly number[];
  glyphIdForCodePoint(codePoint: number): number | undefined;
  codePointsForGlyph(glyphId: number): readonly number[];
  advanceWidth(glyphId: number): number;
  hasGlyph(glyphId: number): boolean;
  glyphMetrics(glyphId: number): GlyphMetrics | undefined;
  glyphOutline(glyphId: number): GlyphOutline | undefined;
}

class Reader {
  private readonly data: Uint8Array;
  private offset: number;

  constructor(data: Uint8Array, start = 0) {
    this.data = data;
    this.offset = start;
  }

  get position(): number {
    return this.offset;
  }

  seek(offset: number): void {
    this.offset = offset;
  }

  skip(bytes: number): void {
    this.offset += bytes;
  }

  uint8(): number {
    const value = this.data[this.offset] ?? 0;
    this.offset += 1;
    return value;
  }

  int16(): number {
    const value = this.uint16();
    return value >= 0x8000 ? value - 0x10000 : value;
  }

  uint16(): number {
    const hi = this.uint8();
    const lo = this.uint8();
    return (hi << 8) | lo;
  }

  int32(): number {
    const hi = this.uint16();
    const lo = this.uint16();
    const value = ((hi << 16) | lo) >>> 0;
    return value >= 0x80000000 ? value - 0x100000000 : value;
  }

  uint32(): number {
    return ((this.uint16() << 16) | this.uint16()) >>> 0;
  }

  tag(): string {
    const value = this.uint32();
    return String.fromCharCode(
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    );
  }

  bytes(length: number): Uint8Array {
    const slice = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }
}

interface TableDirectory {
  readonly offset: number;
  readonly length: number;
}

function readTableDirectory(data: Uint8Array): Map<number, TableDirectory> {
  const reader = new Reader(data);
  const version = reader.uint32();
  if (version !== 0x00010000 && version !== 0x74727565) {
    throw new ShapingError(
      `unsupported font format (sfnt version 0x${version.toString(16)}); TrueType outlines are required`,
    );
  }
  const numTables = reader.uint16();
  reader.skip(6);
  const tables = new Map<number, TableDirectory>();
  for (let i = 0; i < numTables; i += 1) {
    const tag = tagToInt(reader.tag());
    reader.uint32(); // checksum
    const offset = reader.uint32();
    const length = reader.uint32();
    tables.set(tag, { offset, length });
  }
  return tables;
}

function readCmap(data: Uint8Array, table: TableDirectory): Map<number, number> {
  const reader = new Reader(data, table.offset);
  reader.uint16(); // version
  const numTables = reader.uint16();
  const candidates: { offset: number; score: number }[] = [];
  for (let i = 0; i < numTables; i += 1) {
    const platform = reader.uint16();
    reader.uint16(); // encodingID: recorded by the platform check below
    const offset = reader.uint32();
    let score = 0;
    if (platform === WINDOWS_UNICODE_FULL) score = 5;
    else if (platform === WINDOWS_UNICODE_BMP) score = 4;
    else if (platform === 0) score = 3;
    else if (platform === MAC_ROMAN) score = 1;
    if (score > 0) candidates.push({ offset: table.offset + offset, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) throw new ShapingError('the font has no usable cmap subtable');
  return readCmapSubtable(data, best.offset);
}

function readCmapSubtable(data: Uint8Array, offset: number): Map<number, number> {
  const reader = new Reader(data, offset);
  const format = reader.uint16();
  const mapping = new Map<number, number>();
  if (format === 4) {
    reader.uint16(); // length
    reader.uint16(); // language
    const segCountX2 = reader.uint16();
    const segCount = segCountX2 / 2;
    reader.skip(6);
    const endCodes: number[] = [];
    for (let i = 0; i < segCount; i += 1) endCodes.push(reader.uint16());
    reader.uint16(); // reservedPad
    const startCodes: number[] = [];
    for (let i = 0; i < segCount; i += 1) startCodes.push(reader.uint16());
    const deltas: number[] = [];
    for (let i = 0; i < segCount; i += 1) deltas.push(reader.uint16());
    const rangeOffsetBase = reader.position;
    const rangeOffsets: number[] = [];
    for (let i = 0; i < segCount; i += 1) rangeOffsets.push(reader.uint16());
    for (let segment = 0; segment < segCount; segment += 1) {
      const start = startCodes[segment]!;
      const end = endCodes[segment]!;
      const delta = deltas[segment]!;
      const rangeOffset = rangeOffsets[segment]!;
      if (start === 0xffff) continue;
      for (let code = start; code <= end; code += 1) {
        let glyphId: number;
        if (rangeOffset === 0) {
          glyphId = (code + delta) & 0xffff;
        } else {
          const glyphIndexOffset = rangeOffsetBase + segment * 2 + rangeOffset + (code - start) * 2;
          const glyphIndexReader = new Reader(data, glyphIndexOffset);
          const raw = glyphIndexReader.uint16();
          glyphId = raw === 0 ? 0 : (raw + delta) & 0xffff;
        }
        if (glyphId !== 0) mapping.set(code, glyphId);
      }
    }
    return mapping;
  }
  if (format === 12) {
    reader.uint16(); // reserved
    reader.uint32(); // length
    reader.uint32(); // language
    const groups = reader.uint32();
    for (let i = 0; i < groups; i += 1) {
      const start = reader.uint32();
      const end = reader.uint32();
      const startGlyph = reader.uint32();
      for (let code = start; code <= end; code += 1) {
        mapping.set(code, startGlyph + (code - start));
      }
    }
    return mapping;
  }
  if (format === 6) {
    reader.uint16(); // length
    reader.uint16(); // language
    const first = reader.uint16();
    const count = reader.uint16();
    for (let i = 0; i < count; i += 1) {
      const glyphId = reader.uint16();
      if (glyphId !== 0) mapping.set(first + i, glyphId);
    }
    return mapping;
  }
  if (format === 0) {
    reader.uint16(); // length
    reader.uint16(); // language
    for (let code = 0; code < 256; code += 1) {
      const glyphId = reader.uint8();
      if (glyphId !== 0) mapping.set(code, glyphId);
    }
    return mapping;
  }
  throw new ShapingError(`unsupported cmap subtable format ${format}`);
}

function readName(data: Uint8Array, table: TableDirectory): Map<number, string> {
  const reader = new Reader(data, table.offset);
  const format = reader.uint16();
  const names = new Map<number, string>();
  if (format !== 0) return names;
  const count = reader.uint16();
  const stringOffset = reader.uint16();
  for (let i = 0; i < count; i += 1) {
    const platform = reader.uint16();
    reader.uint16(); // encoding
    reader.uint16(); // language
    const nameId = reader.uint16();
    const length = reader.uint16();
    const offset = reader.uint16();
    if (names.has(nameId)) continue;
    const start = table.offset + stringOffset + offset;
    const bytes = data.subarray(start, start + length);
    const decode = (): string => {
      if (platform === 3 || platform === 0) {
        let out = '';
        for (let b = 0; b + 1 < bytes.length; b += 2) {
          out += String.fromCharCode(((bytes[b] ?? 0) << 8) | (bytes[b + 1] ?? 0));
        }
        return out;
      }
      let out = '';
      for (const byte of bytes) out += String.fromCharCode(byte);
      return out;
    };
    names.set(nameId, decode());
  }
  return names;
}

function computeChecksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i] ?? 0;
    const b = data[i + 1] ?? 0;
    const c = data[i + 2] ?? 0;
    const d = data[i + 3] ?? 0;
    sum = (sum + ((a << 24) | (b << 16) | (c << 8) | d)) >>> 0;
  }
  return sum;
}

export { computeChecksum, tagToInt };

export function parseFont(data: Uint8Array): FontProgram {
  const tables = readTableDirectory(data);
  const head = tables.get(HEAD);
  const hhea = tables.get(HHEA);
  const maxp = tables.get(MAXP);
  const hmtx = tables.get(HMTX);
  const loca = tables.get(LOCA);
  const glyf = tables.get(GLYF);
  if (!head || !hhea || !maxp || !hmtx) {
    throw new ShapingError('the font is missing one of head/hhea/maxp/hmtx');
  }

  // head layout: version(4) fontRevision(4) checkSumAdjustment(4) magicNumber(4)
  //              flags(2) unitsPerEm(2) created(8) modified(8) xMin(2) ...
  const headReader = new Reader(data, head.offset);
  headReader.skip(16);
  headReader.uint16(); // flags
  const unitsPerEm = headReader.uint16();
  headReader.skip(16); // created, modified
  const xMin = headReader.int16();
  const yMin = headReader.int16();
  const xMax = headReader.int16();
  const yMax = headReader.int16();
  const macStyle = headReader.uint16();
  headReader.skip(2); // lowestRecPPEM
  headReader.int16(); // fontDirectionHint
  const indexToLocFormat = headReader.int16();

  const hheaReader = new Reader(data, hhea.offset);
  hheaReader.skip(4);
  const ascent = hheaReader.int16();
  const descent = hheaReader.int16();
  const lineGap = hheaReader.int16();
  hheaReader.skip(2 + 2 + 2 + 2 + 2 + 2 + 2 + 8 + 2);
  const numberOfHMetrics = hheaReader.uint16();

  const maxpReader = new Reader(data, maxp.offset);
  maxpReader.skip(4);
  const numGlyphs = maxpReader.uint16();

  const metrics: { advanceWidth: number; lsb: number }[] = [];
  const hmtxReader = new Reader(data, hmtx.offset);
  for (let i = 0; i < numberOfHMetrics; i += 1) {
    metrics.push({ advanceWidth: hmtxReader.uint16(), lsb: hmtxReader.int16() });
  }
  for (let i = numberOfHMetrics; i < numGlyphs; i += 1) {
    const last = metrics[metrics.length - 1] ?? { advanceWidth: 0, lsb: 0 };
    metrics.push({ advanceWidth: last.advanceWidth, lsb: hmtxReader.int16() });
  }

  const cmapTable = tables.get(CMAP);
  const codePointToGlyph = cmapTable ? readCmap(data, cmapTable) : new Map<number, number>();
  const glyphToCodePoints = new Map<number, number[]>();
  for (const [codePoint, glyphId] of codePointToGlyph) {
    const list = glyphToCodePoints.get(glyphId);
    if (list) list.push(codePoint);
    else glyphToCodePoints.set(glyphId, [codePoint]);
  }
  for (const list of glyphToCodePoints.values()) list.sort((a, b) => a - b);

  const nameTable = tables.get(NAME);
  const names = nameTable ? readName(data, nameTable) : new Map<number, string>();
  const postTable = tables.get(POST);
  let isFixedPitch = false;
  let italicAngle = 0;
  let underlinePosition = 0;
  let underlineThickness = 0;
  if (postTable) {
    const postReader = new Reader(data, postTable.offset);
    postReader.skip(4);
    italicAngle = postReader.int32() / 65536;
    underlinePosition = postReader.int16();
    underlineThickness = postReader.int16();
    isFixedPitch = postReader.uint32() !== 0;
  }

  const os2Table = tables.get(OS2);
  let os2FamilyClass = 0;
  let capHeight = 0;
  let xHeight = 0;
  if (os2Table) {
    const os2Reader = new Reader(data, os2Table.offset);
    const version = os2Reader.uint16();
    os2Reader.skip(2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 10 + 4 * 4 + 4 * 4);
    os2FamilyClass = os2Reader.int16();
    os2Reader.skip(2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 4);
    if (version >= 2) {
      xHeight = os2Reader.int16();
      capHeight = os2Reader.int16();
    }
  }

  const offsets: number[] = [];
  const locaReader = loca ? new Reader(data, loca.offset) : undefined;
  if (locaReader) {
    const count = numGlyphs + 1;
    for (let i = 0; i < count; i += 1) {
      offsets.push(indexToLocFormat === 0 ? locaReader.uint16() * 2 : locaReader.uint32());
    }
  }

  const glyphOutline = (glyphId: number): GlyphOutline | undefined => {
    if (!glyf || !loca || glyphId < 0 || glyphId >= numGlyphs) return undefined;
    const start = offsets[glyphId];
    const end = offsets[glyphId + 1];
    if (start === undefined || end === undefined || end <= start) return undefined;
    const reader = new Reader(data, glyf.offset + start);
    const numberOfContours = reader.int16();
    if (numberOfContours <= 0) return undefined; // composite or empty glyph
    reader.skip(8); // xMin, yMin, xMax, yMax
    const endPoints: number[] = [];
    for (let i = 0; i < numberOfContours; i += 1) endPoints.push(reader.uint16());
    const pointCount = (endPoints[endPoints.length - 1] ?? -1) + 1;
    const instructionLength = reader.uint16();
    reader.skip(instructionLength);
    const flags: number[] = [];
    while (flags.length < pointCount) {
      const flag = reader.uint8();
      flags.push(flag);
      if ((flag & 0x08) !== 0) {
        const repeats = reader.uint8();
        for (let r = 0; r < repeats; r += 1) flags.push(flag);
      }
    }
    const xs: number[] = [];
    let x = 0;
    for (const flag of flags) {
      if ((flag & 0x02) !== 0) {
        const delta = reader.uint8();
        x += (flag & 0x10) !== 0 ? delta : -delta;
      } else if ((flag & 0x10) === 0) {
        x += reader.int16();
      }
      xs.push(x);
    }
    const ys: number[] = [];
    let y = 0;
    for (const flag of flags) {
      if ((flag & 0x04) !== 0) {
        const delta = reader.uint8();
        y += (flag & 0x20) !== 0 ? delta : -delta;
      } else if ((flag & 0x20) === 0) {
        y += reader.int16();
      }
      ys.push(y);
    }
    const points = flags.map((flag, index) => ({
      x: xs[index] ?? 0,
      y: ys[index] ?? 0,
      onCurve: (flag & 0x01) !== 0,
    }));
    return { endPoints, points };
  };

  const glyphMetrics = (glyphId: number): GlyphMetrics | undefined => {
    if (!glyf || !loca || glyphId < 0 || glyphId >= numGlyphs) return undefined;
    const start = offsets[glyphId];
    const end = offsets[glyphId + 1];
    if (start === undefined || end === undefined || end <= start) return undefined;
    const reader = new Reader(data, glyf.offset + start);
    reader.int16(); // numberOfContours
    return {
      xMin: reader.int16(),
      yMin: reader.int16(),
      xMax: reader.int16(),
      yMax: reader.int16(),
    };
  };

  const characterSet = [...codePointToGlyph.keys()].sort((a, b) => a - b);

  const program: FontProgram = {
    unitsPerEm,
    numGlyphs,
    bbox: { xMin, yMin, xMax, yMax },
    ascent,
    descent,
    lineGap,
    capHeight: capHeight || ascent,
    xHeight,
    italicAngle,
    underlinePosition,
    underlineThickness,
    postscriptName: names.get(6) ?? null,
    familyName: names.get(1) ?? null,
    subfamilyName: names.get(2) ?? null,
    fullName: names.get(4) ?? null,
    version: names.get(5) ?? null,
    isFixedPitch,
    macStyleItalic: (macStyle & 0x02) !== 0,
    os2FamilyClass,
    hasOs2: os2Table !== undefined,
    characterSet,
    glyphIdForCodePoint: (codePoint) => codePointToGlyph.get(codePoint),
    codePointsForGlyph: (glyphId) => glyphToCodePoints.get(glyphId) ?? [],
    advanceWidth: (glyphId) => metrics[glyphId]?.advanceWidth ?? 0,
    hasGlyph: (glyphId) => glyphId >= 0 && glyphId < numGlyphs,
    glyphMetrics,
    glyphOutline,
  };
  return program;
}
