/**
 * Independent PDF reader used by the tests.
 *
 * Everything here is derived from the produced PDF *file*: the decompressed
 * content stream, the Type0 font dictionary's `/W` widths, and pdf-lib's own
 * `encodeText`. Nothing reads the renderer's source or its in-memory plan, so a
 * placement assertion cannot pass just because the renderer agrees with itself.
 */
import { inflateSync } from 'node:zlib';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRef } from 'pdf-lib';

/** A `Tj`-ish text run exactly as it appears in the content stream. */
export interface PdfTextRun {
  readonly text: string;
  /** `Tm` translation, points, PDF user space (origin bottom-left). */
  readonly xPt: number;
  readonly yPt: number;
  readonly fontSizePt: number;
  readonly fontRef: string;
  /** True when the run sits inside a `W n` clip. */
  readonly clipped: boolean;
}

export interface PdfTextRunMm {
  readonly text: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly fontSizePt: number;
  readonly clipped: boolean;
}

export interface PdfFilledRectPt {
  readonly xPt: number;
  readonly yPt: number;
  readonly wPt: number;
  readonly hPt: number;
}

export interface PdfReadResult {
  readonly pageWidthMm: number;
  readonly pageHeightMm: number;
  readonly mediaBoxPt: readonly [number, number, number, number];
  readonly runsPt: readonly PdfTextRun[];
  readonly runsMm: readonly PdfTextRunMm[];
  readonly filledRectsPt: readonly PdfFilledRectPt[];
}

export class PdfReader {
  private readonly doc: PDFDocument;
  private readonly widthsByRef = new Map<string, Map<number, number>>();
  private toUnicodeCache: Map<number, string> | undefined;

  private constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  static async load(bytes: Uint8Array): Promise<PdfReader> {
    return new PdfReader(await PDFDocument.load(bytes));
  }

  get document(): PDFDocument {
    return this.doc;
  }

  /** Page size in millimetres, read from the finished `/MediaBox`. */
  pageSizeMm(): { widthMm: number; heightMm: number } {
    const mediaBox = this.doc.getPage(0).getMediaBox();
    return { widthMm: (mediaBox.width * 25.4) / 72, heightMm: (mediaBox.height * 25.4) / 72 };
  }

  mediaBoxPt(): [number, number, number, number] {
    const box = this.doc.getPage(0).getMediaBox();
    return [box.x, box.y, box.width, box.height];
  }

  /** Decompressed content stream of page 1, or '' when the page has no content. */
  contentStream(): string {
    const page = this.doc.getPage(0);
    const contents: unknown = page.node.normalizedEntries().Contents;
    if (contents === undefined) return '';
    const streamRefs: PDFRef[] = [];
    if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i += 1) streamRefs.push(contents.get(i) as PDFRef);
    } else if (contents instanceof PDFRef) {
      streamRefs.push(contents);
    } else {
      throw new Error('page has no /Contents');
    }
    const chunks: string[] = [];
    for (const ref of streamRefs) {
      const stream = this.doc.context.lookup(ref) as {
        getContents?: () => Uint8Array;
        getContentsString?: () => string;
        asUint8Array?: () => Uint8Array;
        contents?: Uint8Array;
      };
      let bytes: Uint8Array;
      if (typeof stream.getContents === 'function') bytes = stream.getContents();
      else if (typeof stream.asUint8Array === 'function') bytes = stream.asUint8Array();
      else if (stream.contents) bytes = stream.contents;
      else if (typeof stream.getContentsString === 'function') {
        chunks.push(stream.getContentsString());
        continue;
      } else throw new Error('cannot read the page content stream');
      const inflated = inflateOrRaw(bytes);
      let text = '';
      for (const byte of inflated) text += String.fromCharCode(byte);
      chunks.push(text);
    }
    return chunks.join('\n');
  }

  runsPt(): PdfTextRun[] {
    return parseRuns(this.contentStream());
  }

  runsMm(): PdfTextRunMm[] {
    const heightMm = this.pageSizeMm().heightMm;
    return this.runsPt().map((run) => ({
      text: run.text,
      xMm: (run.xPt * 25.4) / 72,
      yMm: heightMm - (run.yPt * 25.4) / 72,
      fontSizePt: run.fontSizePt,
      clipped: run.clipped,
    }));
  }

  filledRectsPt(): PdfFilledRectPt[] {
    return parseFilledRects(this.contentStream());
  }

  /**
   * Decodes a run through the PDF's own `/ToUnicode` CMap.
   *
   * pdf-lib does not expose `PDFFont` for a loaded document, so the mapping is
   * taken from the file: the CMap is the authoritative glyph-id -> text record
   * that any PDF reader uses.
   */
  decodeRun(run: PdfTextRun): string {
    const cmap = this.toUnicodeMap();
    const hex = run.text.replace(/[<>]/g, '');
    let out = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      const glyphId = Number.parseInt(hex.slice(i, i + 4), 16);
      out += cmap.get(glyphId) ?? '';
    }
    return out;
  }

  /** glyph id -> text, from the embedded font's `/ToUnicode` stream. */
  toUnicodeMap(): Map<number, string> {
    if (this.toUnicodeCache) return this.toUnicodeCache;
    const map = new Map<number, string>();
    const fontDict = this.fontDict();
    const toUnicode = fontDict.get(PDFName.of('ToUnicode'));
    const stream =
      toUnicode instanceof PDFRef
        ? (this.doc.context.lookup(toUnicode) as {
            getContents?: () => Uint8Array;
            asUint8Array?: () => Uint8Array;
          })
        : (toUnicode as
            { getContents?: () => Uint8Array; asUint8Array?: () => Uint8Array } | undefined);
    const raw = stream?.getContents ? stream.getContents() : stream?.asUint8Array?.();
    if (!raw) throw new Error('embedded font has no /ToUnicode stream');
    const text = String.fromCharCode(...inflateOrRaw(raw));
    const bfchar = /beginbfchar([\s\S]*?)endbfchar/g;
    for (const block of text.matchAll(bfchar)) {
      const pairs = (block[1] ?? '').match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) ?? [];
      for (const pair of pairs) {
        const match = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(pair);
        if (!match) continue;
        map.set(Number.parseInt(match[1]!, 16), hexToText(match[2]!));
      }
    }
    const bfrange = /beginbfrange([\s\S]*?)endbfrange/g;
    for (const block of text.matchAll(bfrange)) {
      const rows = (block[1] ?? '').trim().split('\n');
      for (const row of rows) {
        const match = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(row);
        if (!match) continue;
        const start = Number.parseInt(match[1]!, 16);
        const end = Number.parseInt(match[2]!, 16);
        const target = Number.parseInt(match[3]!, 16);
        for (let id = start; id <= end; id += 1)
          map.set(id, String.fromCodePoint(target + (id - start)));
      }
    }
    this.toUnicodeCache = map;
    return map;
  }

  /** glyph id -> advance in 1/1000 em, from the descendant font's `/W` array. */
  advanceWidth1000(glyphId: number): number {
    return this.widthsForRef(this.fontDict(), 'font').get(glyphId) ?? 0;
  }

  /** Every glyph id present in the descendant font's `/W` array. */
  widthGlyphIds(): number[] {
    return [...this.widthsForRef(this.fontDict(), 'font').keys()].sort((a, b) => a - b);
  }

  private fontDict(): PDFDict {
    const fonts = this.doc
      .getPage(0)
      .node.normalizedEntries()
      .Resources?.lookup(PDFName.of('Font'), PDFDict);
    if (!fonts) throw new Error('page has no font resources');
    const key = fonts.keys()[0];
    if (!key) throw new Error('page has no embedded font');
    const entry = fonts.get(key);
    const resolved = entry instanceof PDFRef ? this.doc.context.lookup(entry) : entry;
    if (!(resolved instanceof PDFDict)) throw new Error('font entry is not a dictionary');
    return resolved;
  }

  /** Advance width in points for one glyph id, read from the PDF width array. */
  advancePt(glyphId: number, fontSizePt: number): number {
    return (this.advanceWidth1000(glyphId) / 1000) * fontSizePt;
  }

  /** Glyph ids of one text run: in Identity-H the stream codes ARE the gids. */
  runGlyphIds(run: PdfTextRun): number[] {
    const hex = run.text.replace(/[<>]/g, '');
    const ids: number[] = [];
    for (let i = 0; i + 4 <= hex.length; i += 4) ids.push(Number.parseInt(hex.slice(i, i + 4), 16));
    return ids;
  }

  /** Total advance in points of a text run, from the PDF's own width array. */
  runAdvancePt(run: PdfTextRun): number {
    let total = 0;
    for (const id of this.runGlyphIds(run)) total += this.advancePt(id, run.fontSizePt);
    return total;
  }

  /** The single run whose decoded text equals `text`; throws when ambiguous. */
  findRun(text: string): PdfTextRun {
    const matches = this.runsPt().filter((run) => this.decodeRun(run) === text);
    if (matches.length !== 1) {
      throw new Error(
        `expected exactly one run for ${JSON.stringify(text)}, found ${matches.length}`,
      );
    }
    return matches[0]!;
  }

  private widthsForRef(font: PDFDict, refKey: string): Map<number, number> {
    const cached = this.widthsByRef.get(refKey);
    if (cached) return cached;
    const descendant = lookupDescendant(this.doc, font);
    const widths = new Map<number, number>();
    const wArray = descendant?.lookup(PDFName.of('W'), PDFArray);
    if (wArray) {
      let i = 0;
      while (i < wArray.size()) {
        const first = wArray.lookup(i, PDFNumber)?.asNumber();
        if (first === undefined) break;
        const second = wArray.get(i + 1);
        if (second instanceof PDFArray) {
          for (let j = 0; j < second.size(); j += 1) {
            const value = second.lookup(j, PDFNumber)?.asNumber();
            if (value !== undefined) widths.set(first + j, value);
          }
          i += 2;
        } else {
          const last = wArray.lookup(i + 1, PDFNumber)?.asNumber();
          const value = wArray.lookup(i + 2, PDFNumber)?.asNumber();
          if (last === undefined || value === undefined) break;
          for (let gid = first; gid <= last; gid += 1) widths.set(gid, value);
          i += 3;
        }
      }
    }
    this.widthsByRef.set(refKey, widths);
    return widths;
  }
}

function lookupDescendant(doc: PDFDocument, font: PDFDict): PDFDict | undefined {
  const descendants = font.lookup(PDFName.of('DescendantFonts'), PDFArray);
  if (!descendants || descendants.size() === 0) return undefined;
  const first = descendants.get(0);
  if (first instanceof PDFRef) {
    const resolved = doc.context.lookup(first);
    if (resolved instanceof PDFDict) return resolved;
  }
  if (first instanceof PDFDict) return first;
  return undefined;
}

function inflateOrRaw(bytes: Uint8Array): Uint8Array {
  try {
    return inflateSync(bytes);
  } catch {
    return bytes;
  }
}

function hexToText(hex: string): string {
  let out = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    out += String.fromCharCode(Number.parseInt(hex.slice(i, i + 4), 16));
  }
  return out;
}

/** Extracts `Tm` position, `Tf` size and `Tj` payload, tracking `W n` clips. */
export function parseRuns(content: string): PdfTextRun[] {
  const runs: PdfTextRun[] = [];
  let xPt = 0;
  let yPt = 0;
  let fontSizePt = 0;
  let fontName = '';
  let pendingClip = false;
  const tokens = content.split(/\s+/).filter((token) => token.length > 0);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token === 'W') {
      pendingClip = true;
      continue;
    }
    if (token === 'n') {
      continue;
    }
    if (token === 'Tf') {
      fontName = tokens[i - 2] ?? '';
      const size = Number(tokens[i - 1]);
      if (Number.isFinite(size)) fontSizePt = size;
      continue;
    }
    if (token === 'Tm') {
      const values = tokens.slice(i - 6, i).map((value) => Number(value));
      if (values.length === 6 && values.every((value) => Number.isFinite(value))) {
        xPt = values[4]!;
        yPt = values[5]!;
      }
      continue;
    }
    if (token === 'Tj' || token === 'TJ') {
      const previous = tokens[i - 1] ?? '';
      if (previous.startsWith('<')) {
        runs.push({
          text: previous,
          xPt,
          yPt,
          fontSizePt,
          fontRef: fontName,
          clipped: pendingClip,
        });
      }
      continue;
    }
  }
  return runs;
}

/** Extracts `re f` filled rectangles, used for the full-em clipping probe. */
export function parseFilledRects(content: string): PdfFilledRectPt[] {
  const rects: PdfFilledRectPt[] = [];
  const tokens = content.split(/\s+/).filter((token) => token.length > 0);
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] === 're' && tokens[i + 1] === 'f') {
      const values = tokens.slice(i - 4, i).map((value) => Number(value));
      if (values.length === 4 && values.every((value) => Number.isFinite(value))) {
        rects.push({ xPt: values[0]!, yPt: values[1]!, wPt: values[2]!, hPt: values[3]! });
      }
    }
  }
  return rects;
}
