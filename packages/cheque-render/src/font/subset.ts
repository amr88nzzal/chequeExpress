/**
 * Minimal TrueType subsetter: keeps only the glyphs a document actually uses,
 * renumbering them from 1 (glyph 0 is always the empty `.notdef`).
 *
 * It emits `head`, `hhea`, `hmtx`, `maxp`, `post`, `name`, `OS/2` (when the
 * source has one), `loca` and `glyf`. Shaping already happened before this
 * point, so `GSUB`/`GPOS`/`cmap` are intentionally dropped: the PDF addresses
 * glyphs by id through an Identity-H CID font.
 */
import { computeChecksum, type FontProgram, type GlyphOutline } from './ttf.ts';

class ByteWriter {
  private readonly bytes: number[] = [];

  uint8(value: number): void {
    this.bytes.push(value & 0xff);
  }

  uint16(value: number): void {
    this.uint8(value >> 8);
    this.uint8(value);
  }

  int16(value: number): void {
    this.uint16(value < 0 ? value + 0x10000 : value);
  }

  int32(value: number): void {
    this.uint32(value < 0 ? value + 0x100000000 : value);
  }

  uint32(value: number): void {
    this.uint8(value >>> 24);
    this.uint8(value >>> 16);
    this.uint8(value >>> 8);
    this.uint8(value);
  }

  tag(value: string): void {
    for (let i = 0; i < 4; i += 1) this.uint8(value.charCodeAt(i));
  }

  raw(value: Uint8Array): void {
    for (const byte of value) this.uint8(byte);
  }

  pad(alignment: number): void {
    while (this.bytes.length % alignment !== 0) this.uint8(0);
  }

  get length(): number {
    return this.bytes.length;
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeOutline(outline: GlyphOutline): Uint8Array {
  const points = outline.points;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const xMin = Math.min(...xs);
  const yMin = Math.min(...ys);
  const xMax = Math.max(...xs);
  const yMax = Math.max(...ys);

  const xDeltas: number[] = [];
  const yDeltas: number[] = [];
  let previousX = 0;
  let previousY = 0;
  for (const point of points) {
    xDeltas.push(point.x - previousX);
    yDeltas.push(point.y - previousY);
    previousX = point.x;
    previousY = point.y;
  }

  const xFlags: { flag: number; value: number }[] = [];
  for (const delta of xDeltas) {
    if (delta === 0) xFlags.push({ flag: 0x11, value: 0 });
    else if (delta >= -255 && delta <= 255) {
      xFlags.push({ flag: 0x02 | (delta > 0 ? 0x10 : 0), value: Math.abs(delta) });
    } else xFlags.push({ flag: 0x00, value: delta });
  }
  const yFlags: { flag: number; value: number }[] = [];
  for (const delta of yDeltas) {
    if (delta === 0) yFlags.push({ flag: 0x11, value: 0 });
    else if (delta >= -255 && delta <= 255) {
      yFlags.push({ flag: 0x04 | (delta > 0 ? 0x20 : 0), value: Math.abs(delta) });
    } else yFlags.push({ flag: 0x00, value: delta });
  }

  const body = new ByteWriter();
  body.int16(outline.endPoints.length);
  body.int16(xMin);
  body.int16(yMin);
  body.int16(xMax);
  body.int16(yMax);
  for (const endPoint of outline.endPoints) body.uint16(endPoint);
  body.uint16(0); // instructionLength
  // Repeat flags are deliberately not packed: a slightly larger subset is
  // cheaper than a packing bug.
  for (let i = 0; i < points.length; i += 1) {
    body.uint8((points[i]!.onCurve ? 0x01 : 0) | xFlags[i]!.flag | yFlags[i]!.flag);
  }
  for (const entry of xFlags) {
    if (entry.flag === 0x00) body.int16(entry.value);
    else if (entry.flag === 0x02 || entry.flag === 0x12) body.uint8(entry.value);
  }
  for (const entry of yFlags) {
    if (entry.flag === 0x00) body.int16(entry.value);
    else if (entry.flag === 0x04 || entry.flag === 0x24) body.uint8(entry.value);
  }
  return body.toUint8Array();
}

/** The glyphs of the source font that the subset keeps, in subset id order. */
export class FontSubsetBuilder {
  private readonly glyphIds: number[] = [];
  private readonly subsetIdByGlyphId = new Map<number, number>();
  private readonly program: FontProgram;

  constructor(program: FontProgram) {
    this.program = program;
  }

  include(glyphId: number): number {
    const existing = this.subsetIdByGlyphId.get(glyphId);
    if (existing !== undefined) return existing;
    const subsetId = this.glyphIds.length + 1;
    this.glyphIds.push(glyphId);
    this.subsetIdByGlyphId.set(glyphId, subsetId);
    return subsetId;
  }

  get includedGlyphIds(): readonly number[] {
    return this.glyphIds;
  }

  build(): Uint8Array {
    const program = this.program;
    const glyphCount = this.glyphIds.length + 1;
    const glyphs: Uint8Array[] = [new Uint8Array(0)];
    const locaOffsets: number[] = [0];
    let glyfOffset = 0;
    for (const glyphId of this.glyphIds) {
      const outline = program.glyphOutline(glyphId);
      const data = outline ? encodeOutline(outline) : new Uint8Array(0);
      const padded = concat([data, new Uint8Array((4 - (data.length % 4)) % 4)]);
      glyphs.push(padded);
      glyfOffset += padded.length;
      locaOffsets.push(glyfOffset);
    }
    const glyf = concat(glyphs);
    const useShortLoca = glyfOffset <= 0x1fffe;
    const loca = new ByteWriter();
    for (const offset of locaOffsets) {
      if (useShortLoca) loca.uint16(offset / 2);
      else loca.uint32(offset);
    }
    const locaBytes = loca.toUint8Array();

    const head = new ByteWriter();
    head.uint32(0x00010000);
    head.uint32(0x00010000);
    head.uint32(0); // checkSumAdjustment, patched after assembly
    head.uint32(0x5f0f3cf5);
    head.uint16(0x000b);
    head.uint16(program.unitsPerEm);
    head.raw(new Uint8Array(16));
    head.int16(program.bbox.xMin);
    head.int16(program.bbox.yMin);
    head.int16(program.bbox.xMax);
    head.int16(program.bbox.yMax);
    head.uint16(program.macStyleItalic ? 0x02 : 0);
    head.uint16(8);
    head.int16(2);
    head.int16(useShortLoca ? 0 : 1);
    head.int16(0);

    const hhea = new ByteWriter();
    hhea.uint32(0x00010000);
    hhea.int16(program.ascent);
    hhea.int16(program.descent);
    hhea.int16(program.lineGap);
    hhea.uint16(0); // advanceWidthMax
    hhea.int16(0);
    hhea.int16(0);
    hhea.int16(program.bbox.xMax);
    hhea.int16(1);
    hhea.int16(0);
    hhea.int16(0);
    for (let i = 0; i < 4; i += 1) hhea.int16(0);
    hhea.int16(0);
    hhea.uint16(glyphCount);

    const hmtx = new ByteWriter();
    for (const glyphId of this.glyphIds) {
      hmtx.uint16(program.advanceWidth(glyphId));
      hmtx.int16(0);
    }
    hmtx.uint16(0); // .notdef advance
    hmtx.int16(0);

    const maxp = new ByteWriter();
    maxp.uint32(0x00010000);
    maxp.uint16(glyphCount);
    maxp.uint16(4);
    maxp.uint16(1);
    for (let i = 0; i < 11; i += 1) maxp.uint16(0);

    const post = new ByteWriter();
    post.uint32(0x00030000);
    post.int32(Math.round(program.italicAngle * 65536));
    post.int16(program.underlinePosition);
    post.int16(program.underlineThickness);
    post.uint32(program.isFixedPitch ? 1 : 0);
    post.uint32(0);
    post.uint32(0);
    post.uint32(0);
    post.uint32(0);

    const name = buildName(program.familyName ?? 'Subset', program.postscriptName ?? 'Subset');

    const tables: { tag: string; data: Uint8Array }[] = [
      { tag: 'glyf', data: glyf },
      { tag: 'head', data: head.toUint8Array() },
      { tag: 'hhea', data: hhea.toUint8Array() },
      { tag: 'hmtx', data: hmtx.toUint8Array() },
      { tag: 'loca', data: locaBytes },
      { tag: 'maxp', data: maxp.toUint8Array() },
      { tag: 'name', data: name },
      { tag: 'post', data: post.toUint8Array() },
    ];
    if (program.hasOs2) tables.push({ tag: 'OS/2', data: buildOs2(program) });
    tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));

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
    // Recompute the head checksum entry after checkSumAdjustment is written,
    // otherwise the table directory and head disagree.
    const adjustmentOffset = headDataOffset + 8;
    const zeroed = Uint8Array.from(font);
    zeroed.fill(0, adjustmentOffset, adjustmentOffset + 4);
    const adjustment = (0xb1b0afba - computeChecksum(zeroed)) >>> 0;
    font[adjustmentOffset] = (adjustment >>> 24) & 0xff;
    font[adjustmentOffset + 1] = (adjustment >>> 16) & 0xff;
    font[adjustmentOffset + 2] = (adjustment >>> 8) & 0xff;
    font[adjustmentOffset + 3] = adjustment & 0xff;

    const headTableIndex = tables.findIndex((table) => table.tag === 'head');
    const headEntryOffset = 12 + headTableIndex * 16 + 4;
    const headChecksum = computeChecksum(
      font.subarray(headDataOffset, headDataOffset + tables[headTableIndex]!.data.length),
    );
    const directoryWithHeadChecksum = Uint8Array.from(font);
    directoryWithHeadChecksum[headEntryOffset] = (headChecksum >>> 24) & 0xff;
    directoryWithHeadChecksum[headEntryOffset + 1] = (headChecksum >>> 16) & 0xff;
    directoryWithHeadChecksum[headEntryOffset + 2] = (headChecksum >>> 8) & 0xff;
    directoryWithHeadChecksum[headEntryOffset + 3] = headChecksum & 0xff;
    return directoryWithHeadChecksum;
  }
}

function buildName(family: string, postscript: string): Uint8Array {
  const records: { nameId: number; value: string }[] = [
    { nameId: 1, value: family },
    { nameId: 2, value: 'Regular' },
    { nameId: 4, value: family },
    { nameId: 6, value: postscript },
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
  writer.uint16(0);
  writer.uint16(encoded.length);
  writer.uint16(6 + encoded.length * 12);
  let cursor = 0;
  for (const record of encoded) {
    writer.uint16(3);
    writer.uint16(1);
    writer.uint16(0x0409);
    writer.uint16(record.nameId);
    writer.uint16(record.bytes.length);
    writer.uint16(cursor);
    cursor += record.bytes.length;
  }
  for (const record of encoded) writer.raw(record.bytes);
  return writer.toUint8Array();
}

function buildOs2(program: FontProgram): Uint8Array {
  const writer = new ByteWriter();
  writer.uint16(4);
  writer.int16(500);
  writer.uint16(400);
  writer.uint16(5);
  writer.uint16(0);
  writer.int16(500);
  writer.int16(500);
  writer.int16(0);
  writer.int16(100);
  writer.int16(500);
  writer.int16(500);
  writer.int16(0);
  writer.int16(400);
  writer.int16(50);
  writer.int16(250);
  writer.int16(program.os2FamilyClass);
  writer.raw(new Uint8Array(10));
  writer.uint32(1);
  writer.uint32(0);
  writer.uint32(0);
  writer.uint32(0);
  writer.tag('SUBS');
  writer.tag('SUBS');
  writer.tag('SUBS');
  writer.tag('SUBS');
  writer.uint16(0xc000);
  writer.uint16(0x0020);
  writer.uint16(0xfeef);
  writer.int16(program.ascent);
  writer.int16(program.descent);
  writer.int16(0);
  writer.uint16(program.ascent);
  writer.uint16(-program.descent);
  writer.uint32(0);
  writer.uint32(0);
  writer.int16(program.xHeight);
  writer.int16(program.capHeight);
  writer.uint16(0);
  writer.uint16(0x0020);
  writer.uint16(1);
  return writer.toUint8Array();
}
