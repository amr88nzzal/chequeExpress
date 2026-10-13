/**
 * Builds the package's own Arabic test font (`test/fixtures/test-arabic.ttf`).
 *
 * Why a hand-built font instead of a real one: this environment has no network
 * access and no system font that may legally be redistributed, so the shaping
 * tests need a fixture whose tables we own outright. The font is intentionally
 * tiny (26 glyphs, fixed 500-unit advances) so the tests can assert exact glyph
 * ids and exact millimetre positions.
 *
 * It is a *test fixture only*: the production Arabic font is still pending the
 * project owner's approval (see README and docs/DESIGN.md 12).
 *
 * ## What it carries, and what it deliberately does not
 *
 * `cmap` spells both the base Arabic letters and their Arabic Presentation Forms,
 * so the joining step (`src/text/joining.ts`) can address joined glyphs by code
 * point. The font has **no `GSUB`**: HarfBuzz selects its Arabic shaper from the
 * scripts a font declares in its layout tables, and this `harfbuzzjs` build
 * reports no scripts for a hand-built `GSUB` (an empty table, a table holding only
 * the `arab` script, and a full table with `init`/`medi`/`fina`/`isol`/`rlig`
 * lookups were each rejected, while a real font's `GSUB` in the same font slot is
 * recognised). Ship-style joining therefore happens in TypeScript, and HarfBuzz
 * shapes the resulting presentation forms.
 *
 * Usage: `node tools/build-test-font.ts test/fixtures/test-arabic.ttf`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ByteWriter, computeChecksum, concat } from './byte-writer.ts';

const UNITS_PER_EM = 1000;
const ADVANCE = 500;
const ASCENT = 800;
const DESCENT = -200;
const X_MIN = 0;
const Y_MIN = -200;
const X_MAX = 1000;
const Y_MAX = 1000;

interface GlyphSpec {
  readonly name: string;
  /** Contour in font units, or `null` for an empty glyph. */
  readonly box: readonly [number, number, number, number] | null;
}

interface CodepointMap {
  readonly codePoint: number;
  readonly glyphIndex: number;
}

/**
 * Glyph order is part of the fixture's contract: the tests assert these ids.
 * `gid` equals the index in this array.
 */
const GLYPHS: readonly GlyphSpec[] = [
  { name: '.notdef', box: null },
  { name: 'alef.isol', box: [80, 0, 220, 600] },
  { name: 'alef.fin', box: [120, 0, 260, 700] },
  { name: 'lam.isol', box: [200, 0, 340, 600] },
  { name: 'lam.init', box: [200, 100, 420, 700] },
  { name: 'lam.fin', box: [200, 0, 420, 600] },
  { name: 'meem.isol', box: [120, 0, 300, 500] },
  { name: 'meem.init', box: [120, 200, 300, 700] },
  { name: 'meem.fin', box: [120, 0, 360, 500] },
  { name: 'meem.medi', box: [120, 200, 360, 700] },
  { name: 'hah.medi', box: [100, 150, 240, 650] },
  { name: 'heh.fin', box: [100, 0, 300, 500] },
  { name: 'heh.isol', box: [100, 0, 260, 500] },
  { name: 'digit.0', box: [50, 0, 450, 600] },
  { name: 'digit.1', box: [50, 0, 450, 700] },
  { name: 'digit.2', box: [50, 0, 450, 800] },
  { name: 'digit.3', box: [50, 0, 450, 900] },
  { name: 'digit.4', box: [50, 0, 450, 950] },
  { name: 'digit.5', box: [50, 0, 450, 975] },
  { name: 'digit.6', box: [50, 0, 450, 1000] },
  { name: 'digit.7', box: [50, 0, 450, 700] },
  { name: 'digit.8', box: [50, 0, 450, 800] },
  { name: 'digit.9', box: [50, 0, 450, 900] },
  { name: 'A', box: [0, 0, 500, 1000] },
  { name: 'seven', box: [0, 0, 1000, 1000] },
  { name: 'slash', box: [50, 0, 400, 700] },
];

const GID = {
  alefIsol: 1,
  alefFin: 2,
  lamIsol: 3,
  lamInit: 4,
  lamFin: 5,
  meemIsol: 6,
  meemInit: 7,
  meemFin: 8,
  meemMedi: 9,
  hahMedi: 10,
  hehFin: 11,
  hehIsol: 12,
  digit0: 13,
  digit1: 14,
  digit2: 15,
  digit3: 16,
  digit4: 17,
  digit5: 18,
  digit6: 19,
  digit7: 20,
  digit8: 21,
  digit9: 22,
  a: 23,
  seven: 24,
  slash: 25,
} as const;

/**
 * Base letters plus the presentation forms `src/text/joining.ts` produces. Both
 * spellings map to the same glyph, which is what lets the tests name the joined
 * result and the joining table stay the single source of the forms.
 */
const CMAP_ENTRIES: readonly CodepointMap[] = [
  { codePoint: 0x0020, glyphIndex: 0 },
  { codePoint: 0x002f, glyphIndex: GID.slash },
  { codePoint: 0x0030, glyphIndex: GID.digit0 },
  { codePoint: 0x0031, glyphIndex: GID.digit1 },
  { codePoint: 0x0032, glyphIndex: GID.digit2 },
  { codePoint: 0x0033, glyphIndex: GID.digit3 },
  { codePoint: 0x0034, glyphIndex: GID.digit4 },
  { codePoint: 0x0035, glyphIndex: GID.digit5 },
  { codePoint: 0x0036, glyphIndex: GID.digit6 },
  { codePoint: 0x0037, glyphIndex: GID.seven },
  { codePoint: 0x0038, glyphIndex: GID.digit8 },
  { codePoint: 0x0039, glyphIndex: GID.digit9 },
  { codePoint: 0x0041, glyphIndex: GID.a },
  { codePoint: 0x0627, glyphIndex: GID.alefIsol },
  { codePoint: 0x062d, glyphIndex: GID.hahMedi },
  { codePoint: 0x0644, glyphIndex: GID.lamIsol },
  { codePoint: 0x0645, glyphIndex: GID.meemIsol },
  { codePoint: 0x0647, glyphIndex: GID.hehIsol },
  { codePoint: 0xfe8d, glyphIndex: GID.alefIsol },
  { codePoint: 0xfe8e, glyphIndex: GID.alefFin },
  { codePoint: 0xfee0, glyphIndex: GID.hahMedi },
  { codePoint: 0xfee1, glyphIndex: GID.meemIsol },
  { codePoint: 0xfee2, glyphIndex: GID.meemFin },
  { codePoint: 0xfee3, glyphIndex: GID.meemInit },
  { codePoint: 0xfee4, glyphIndex: GID.meemMedi },
  { codePoint: 0xfee7, glyphIndex: GID.hahMedi },
  { codePoint: 0xfee9, glyphIndex: GID.hehIsol },
  { codePoint: 0xfeea, glyphIndex: GID.hehFin },
  { codePoint: 0xfeeb, glyphIndex: GID.hehFin },
  { codePoint: 0xfeec, glyphIndex: GID.hehFin },
  { codePoint: 0xfeed, glyphIndex: GID.lamIsol },
  { codePoint: 0xfeee, glyphIndex: GID.lamFin },
  { codePoint: 0xfeef, glyphIndex: GID.lamInit },
];

function entriesOf(maps: readonly CodepointMap[]): CodepointMap[] {
  const sorted = [...maps].sort((a, b) => a.codePoint - b.codePoint);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.codePoint === sorted[i - 1]!.codePoint) {
      throw new Error(`duplicate cmap code point: ${sorted[i]!.codePoint}`);
    }
  }
  return sorted;
}

/** Simple 4-point contour, always on-curve, which keeps the glyf data trivial. */
function rectangleGlyph([x0, y0, x1, y1]: readonly [number, number, number, number]): Uint8Array {
  const writer = new ByteWriter();
  writer.int16(1); // numberOfContours
  writer.int16(x0);
  writer.int16(y0);
  writer.int16(x1);
  writer.int16(y1);
  writer.uint16(3); // endPtsOfContours[0]
  writer.uint16(0); // instructionLength
  for (let i = 0; i < 4; i += 1) writer.uint8(0x01); // on-curve, 16-bit deltas
  const xs = [x0, x1, x1, x0];
  const ys = [y0, y0, y1, y1];
  let previousX = 0;
  let previousY = 0;
  for (let i = 0; i < 4; i += 1) {
    writer.int16(xs[i]! - previousX);
    writer.int16(ys[i]! - previousY);
    previousX = xs[i]!;
    previousY = ys[i]!;
  }
  return writer.toUint8Array();
}

function buildGlyfAndLoca(): { glyf: Uint8Array; loca: Uint8Array } {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;
  for (const glyph of GLYPHS) {
    offsets.push(offset);
    const data = glyph.box ? rectangleGlyph(glyph.box) : new Uint8Array(0);
    const padded = concat([data, new Uint8Array((4 - (data.length % 4)) % 4)]);
    chunks.push(padded);
    offset += padded.length;
  }
  offsets.push(offset);
  const locaWriter = new ByteWriter();
  for (const value of offsets) locaWriter.uint32(value);
  return { glyf: concat(chunks), loca: locaWriter.toUint8Array() };
}

function buildCmap(): Uint8Array {
  const sorted = entriesOf(CMAP_ENTRIES);
  // Group into runs where gid - codePoint is constant, so every run can use
  // idRangeOffset = 0 and idDelta arithmetic only.
  const runs: { startCode: number; endCode: number; delta: number }[] = [];
  for (const entry of sorted) {
    const delta = (entry.glyphIndex - entry.codePoint) & 0xffff;
    const last = runs[runs.length - 1];
    if (last && last.delta === delta && last.endCode + 1 === entry.codePoint) {
      last.endCode = entry.codePoint;
    } else {
      runs.push({ startCode: entry.codePoint, endCode: entry.codePoint, delta });
    }
  }
  const segCount = runs.length + 1; // +1 for the mandatory 0xffff terminator
  const writer = new ByteWriter();
  writer.uint16(4); // format
  writer.uint16(16 + segCount * 8); // length
  writer.uint16(0); // language
  writer.uint16(segCount * 2);
  const searchRange = 2 * 2 ** Math.floor(Math.log2(segCount));
  writer.uint16(searchRange);
  writer.uint16(Math.log2(searchRange / 2));
  writer.uint16(segCount - searchRange / 2);
  for (const run of runs) writer.uint16(run.endCode);
  writer.uint16(0xffff);
  writer.uint16(0); // reservedPad
  for (const run of runs) writer.uint16(run.startCode);
  writer.uint16(0xffff);
  for (const run of runs) writer.uint16(run.delta);
  writer.uint16(1);
  for (let i = 0; i < segCount; i += 1) writer.uint16(0); // idRangeOffset

  const subtable = writer.toUint8Array();
  const header = new ByteWriter();
  header.uint16(0); // version
  header.uint16(1); // numTables
  header.uint16(3); // platformID: Windows
  header.uint16(1); // encodingID: Unicode BMP
  header.uint32(12); // offset to subtable
  return concat([header.toUint8Array(), subtable]);
}

function buildHead(): Uint8Array {
  const writer = new ByteWriter();
  writer.uint32(0x00010000); // version
  writer.uint32(0x00010000); // fontRevision
  writer.uint32(0); // checkSumAdjustment (patched at the end)
  writer.uint32(0x5f0f3cf5); // magicNumber
  writer.uint16(0x000b); // flags
  writer.uint16(UNITS_PER_EM);
  writer.raw(new Uint8Array(16)); // created + modified
  writer.int16(X_MIN);
  writer.int16(Y_MIN);
  writer.int16(X_MAX);
  writer.int16(Y_MAX);
  writer.uint16(0); // macStyle
  writer.uint16(8); // lowestRecPPEM
  writer.int16(2); // fontDirectionHint
  writer.int16(1); // indexToLocFormat: long
  writer.int16(0); // glyphDataFormat
  return writer.toUint8Array();
}

function buildHhea(numberOfHMetrics: number): Uint8Array {
  const writer = new ByteWriter();
  writer.uint32(0x00010000);
  writer.int16(ASCENT);
  writer.int16(DESCENT);
  writer.int16(0); // lineGap
  writer.uint16(ADVANCE); // advanceWidthMax
  writer.int16(0); // minLeftSideBearing
  writer.int16(0); // minRightSideBearing
  writer.int16(X_MAX); // xMaxExtent
  writer.int16(1); // caretSlopeRise
  writer.int16(0); // caretSlopeRun
  writer.int16(0); // caretOffset
  for (let i = 0; i < 4; i += 1) writer.int16(0); // reserved
  writer.int16(0); // metricDataFormat
  writer.uint16(numberOfHMetrics);
  return writer.toUint8Array();
}

function buildMaxp(numGlyphs: number): Uint8Array {
  const writer = new ByteWriter();
  writer.uint32(0x00010000);
  writer.uint16(numGlyphs);
  writer.uint16(4); // maxPoints (one 4-point contour per glyph)
  writer.uint16(1); // maxContours
  writer.uint16(0); // maxCompositePoints
  writer.uint16(0); // maxCompositeContours
  writer.uint16(2); // maxZones
  writer.uint16(0); // maxTwilightPoints
  writer.uint16(0); // maxStorage
  writer.uint16(0); // maxFunctionDefs
  writer.uint16(0); // maxInstructionDefs
  writer.uint16(0); // maxStackElements
  writer.uint16(0); // maxSizeOfInstructions
  writer.uint16(0); // maxComponentElements
  writer.uint16(0); // maxComponentDepth
  return writer.toUint8Array();
}

function buildHmtx(count: number): Uint8Array {
  const writer = new ByteWriter();
  for (let i = 0; i < count; i += 1) {
    writer.uint16(ADVANCE);
    writer.int16(0);
  }
  return writer.toUint8Array();
}

function buildOs2(): Uint8Array {
  const writer = new ByteWriter();
  writer.uint16(4); // version
  writer.int16(ADVANCE); // xAvgCharWidth
  writer.uint16(400); // usWeightClass
  writer.uint16(5); // usWidthClass
  writer.uint16(0); // fsType: installable embedding
  writer.int16(ADVANCE); // ySubscriptXSize
  writer.int16(ADVANCE); // ySubscriptYSize
  writer.int16(0); // ySubscriptXOffset
  writer.int16(100); // ySubscriptYOffset
  writer.int16(ADVANCE); // ySuperscriptXSize
  writer.int16(ADVANCE); // ySuperscriptYSize
  writer.int16(0); // ySuperscriptXOffset
  writer.int16(400); // ySuperscriptYOffset
  writer.int16(50); // yStrikeoutSize
  writer.int16(250); // yStrikeoutPosition
  writer.int16(0); // sFamilyClass
  writer.raw(new Uint8Array(10)); // panose
  writer.uint32(1); // ulUnicodeRange1
  writer.uint32(0);
  writer.uint32(0);
  writer.uint32(0);
  writer.tag('TEST');
  writer.tag('TEST');
  writer.tag('TEST');
  writer.tag('TEST');
  writer.uint16(0xc000); // fsSelection: regular + use typo metrics
  writer.uint16(0x0020); // usFirstCharIndex
  writer.uint16(0xfeef); // usLastCharIndex
  writer.int16(ASCENT); // sTypoAscender
  writer.int16(DESCENT); // sTypoDescender
  writer.int16(0); // sTypoLineGap
  writer.uint16(ASCENT); // usWinAscent
  writer.uint16(-DESCENT); // usWinDescent
  writer.uint32(0); // ulCodePageRange1
  writer.uint32(0); // ulCodePageRange2
  writer.int16(500); // sxHeight
  writer.int16(700); // sCapHeight
  writer.uint16(0); // usDefaultChar
  writer.uint16(0x0020); // usBreakChar
  writer.uint16(1); // usMaxContext
  return writer.toUint8Array();
}

function buildPost(): Uint8Array {
  const writer = new ByteWriter();
  writer.uint32(0x00030000);
  writer.int32(0); // italicAngle
  writer.int16(-100); // underlinePosition
  writer.int16(50); // underlineThickness
  writer.uint32(1); // isFixedPitch
  writer.uint32(0);
  writer.uint32(0);
  writer.uint32(0);
  writer.uint32(0);
  return writer.toUint8Array();
}

function buildName(): Uint8Array {
  const records: { nameId: number; value: string }[] = [
    { nameId: 1, value: 'ChequeRenderTestArabic' },
    { nameId: 2, value: 'Regular' },
    { nameId: 3, value: 'ChequeRenderTestArabic-Regular-1.0' },
    { nameId: 4, value: 'ChequeRenderTestArabic' },
    { nameId: 6, value: 'ChequeRenderTestArabic-Regular' },
  ];
  const encoded = records.map((record) => {
    const bytes = new Uint8Array(record.value.length * 2);
    for (let i = 0; i < record.value.length; i += 1) {
      const code = record.value.charCodeAt(i);
      bytes[i * 2] = code >> 8;
      bytes[i * 2 + 1] = code & 0xff;
    }
    return { nameId: record.nameId, bytes };
  });
  const writer = new ByteWriter();
  writer.uint16(0); // format
  writer.uint16(encoded.length);
  writer.uint16(6 + encoded.length * 12); // stringOffset
  let cursor = 0;
  for (const record of encoded) {
    writer.uint16(3); // platformID: Windows
    writer.uint16(1); // encodingID: Unicode BMP
    writer.uint16(0x0409); // language: en-US
    writer.uint16(record.nameId);
    writer.uint16(record.bytes.length);
    writer.uint16(cursor);
    cursor += record.bytes.length;
  }
  for (const record of encoded) writer.raw(record.bytes);
  return writer.toUint8Array();
}

interface TableRecord {
  readonly tag: string;
  readonly data: Uint8Array;
}

function buildFont(): Uint8Array {
  const { glyf, loca } = buildGlyfAndLoca();
  const glyphCount = GLYPHS.length;
  const tables: TableRecord[] = [
    { tag: 'OS/2', data: buildOs2() },
    { tag: 'cmap', data: buildCmap() },
    { tag: 'glyf', data: glyf },
    { tag: 'head', data: buildHead() },
    { tag: 'hhea', data: buildHhea(glyphCount) },
    { tag: 'hmtx', data: buildHmtx(glyphCount) },
    { tag: 'loca', data: loca },
    { tag: 'maxp', data: buildMaxp(glyphCount) },
    { tag: 'name', data: buildName() },
    { tag: 'post', data: buildPost() },
  ].sort((a, b) => (a.tag < b.tag ? -1 : 1));

  const numTables = tables.length;
  const searchRange = 16 * 2 ** Math.floor(Math.log2(numTables));
  const directory = new ByteWriter();
  directory.uint32(0x00010000);
  directory.uint16(numTables);
  directory.uint16(searchRange);
  directory.uint16(Math.log2(searchRange / 16));
  directory.uint16(numTables * 16 - searchRange);

  let offset = 12 + numTables * 16;
  const bodies: Uint8Array[] = [];
  let headDataOffset = -1;
  for (const table of tables) {
    const padded = concat([table.data, new Uint8Array((4 - (table.data.length % 4)) % 4)]);
    directory.tag(table.tag);
    directory.uint32(computeChecksum(table.data));
    directory.uint32(offset);
    directory.uint32(table.data.length);
    if (table.tag === 'head') headDataOffset = offset;
    bodies.push(padded);
    offset += padded.length;
  }

  const font = concat([directory.toUint8Array(), ...bodies]);

  // checkSumAdjustment first, then the head entry in the directory.
  const adjustmentOffset = headDataOffset + 8;
  const zeroed = Uint8Array.from(font);
  zeroed.fill(0, adjustmentOffset, adjustmentOffset + 4);
  const adjustment = (0xb1b0afba - computeChecksum(zeroed)) >>> 0;
  font[adjustmentOffset] = (adjustment >>> 24) & 0xff;
  font[adjustmentOffset + 1] = (adjustment >>> 16) & 0xff;
  font[adjustmentOffset + 2] = (adjustment >>> 8) & 0xff;
  font[adjustmentOffset + 3] = adjustment & 0xff;

  const headIndex = tables.findIndex((table) => table.tag === 'head');
  const headEntryOffset = 12 + headIndex * 16 + 4;
  const headChecksum = computeChecksum(
    font.subarray(headDataOffset, headDataOffset + tables[headIndex]!.data.length),
  );
  font[headEntryOffset] = (headChecksum >>> 24) & 0xff;
  font[headEntryOffset + 1] = (headChecksum >>> 16) & 0xff;
  font[headEntryOffset + 2] = (headChecksum >>> 8) & 0xff;
  font[headEntryOffset + 3] = headChecksum & 0xff;

  return font;
}

const target = resolve(process.argv[2] ?? 'test/fixtures/test-arabic.ttf');
const bytes = buildFont();
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, bytes);
console.log(`wrote ${target} (${bytes.length} bytes, ${GLYPHS.length} glyphs)`);
