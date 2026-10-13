# @cheques/cheque-render

Renders a cheque to a PDF whose page size is **exactly the cheque size in
millimetres**, with the fields positioned in millimetres and Arabic text
correctly joined, shaped and ordered right-to-left.

Pure TypeScript. No browser, no Chromium, no environment variables, and no
module-level mutable state. `renderCheque` is a pure function; the only code that
touches disk is the `renderChequeToFile` wrapper.

```
pdf-lib      document, page size in points, font subset + embedding
harfbuzzjs   text shaping (WASM build of HarfBuzz 14.x)
bidi-js      Unicode bidirectional algorithm
```

---

## API

```ts
import { renderCheque, renderChequeToFile, renderChequeInspect } from '@cheques/cheque-render';

// In memory (what tests and the preview use):
const bytes: Uint8Array = await renderCheque(layout, profile, data, { fonts: { arabic } });

// Thin wrapper that writes the same bytes:
await renderChequeToFile(layout, profile, data, { fonts: { arabic } }, 'out/cheque.pdf');

// Same render plus its geometry and drawing plan (print preview, diagnostics):
const plan = await renderChequeInspect(layout, profile, data, { fonts: { arabic } });
```

Also exported from the package index: `FIELD_IDS`, `AMOUNT_FIELD_IDS`,
`deriveAmountFigures`, `resolveGeometry`, `layoutField`, `wrapText`,
`completeLine`, `shapeText`, `applyArabicJoining`, `parseFont`,
`FontSubsetBuilder`, `createFontkitAdapter`, the unit helpers, the error classes
and every type.

### Types

```ts
interface ChequeLayout {
  widthMm: number;
  heightMm: number;
  fields: readonly Field[];
}

interface Field {
  id: string;
  xMm: number; // left edge, from the page's left edge
  yMm: number; // TOP edge, from the page's TOP edge
  wMm: number;
  hMm: number;
  align: 'left' | 'right' | 'center';
  fontPt: number;
  lineHeightMm: number;
  maxLines?: number;
  dir?: 'rtl' | 'ltr'; // defaults to 'rtl'
  completeLineWith?: string; // anti-tamper filler for the LAST line
}

interface PrinterProfile {
  dxMm: number;
  dyMm: number; // positive moves content DOWN
  scale?: number; // omitted or 1 means "no scaling"
  paperMode: 'custom' | 'a4';
  originXMm?: number; // 'a4' only
  originYMm?: number; // 'a4' only
  feedOrientation?: 'portrait' | 'landscape';
}

interface ChequeData {
  issueDate: string;
  payee: string;
  amountWordsLine1: string; // carries the dinar figure
  amountWordsLine2: string; // carries the fils figure
  memo?: string;
  closingPhrase: string; // appended to the last words line
}

interface RenderOptions {
  fonts: { arabic: Uint8Array; license?: string; name?: string };
  subset?: boolean; // default true
  title?: string;
  createdAt?: Date; // default: the PDF epoch, so output is reproducible
}
```

**Money is always a string of decimal digits, never a JavaScript number**, and the
amount in figures is **not a separate input**: `deriveAmountFigures` parses the
two decimal fields out of the amount-in-words lines, so the words and the figures
can never disagree. `assertDecimalDigits` and `InvalidAmountError` guard the rule.

### Field ids the renderer fills

`date`, `payee`, `amountWordsLine1`, `amountWordsLine2`, `amountDinar` (or
`amountFigures`), `amountFils`, `memo`. Aliases exist for the spike's names
(`amt_main`, `amt_frac`, `words1`, `words2`, `issueDate`, `beneficiary`, `note`);
see `FIELD_IDS` in `src/render.ts`.

---

## Coordinate system

- All layout values are **millimetres**.
- `yMm` is measured **from the TOP edge** of the page, matching the project's
  original Python spike (`spikes/pdf-print-python`).
- The conversion to PDF's bottom-left origin happens **once**, in
  `src/pdf/writer.ts`, through `units.ts`.
- The page's `/MediaBox` is written from `layout.widthMm` × `layout.heightMm`
  (or 210 × 297 mm for `paperMode: 'a4'`) and is **never derived from the
  content**. Content that runs past an edge is clipped to the page rectangle, so
  no overflow can change the page size. This is the failure that was observed
  with Chromium in the C0 spike, where an overflowing element silently shrank the
  page; the clipping tests assert both halves of the rule.
- Vertical rule for a line inside its box: the baseline sits at
  `yMm + (lineHeightMm + fontPt·mm-per-pt) / 2`.
- Horizontal rule: `left` anchors the run at the box's left edge, `right` at its
  right edge, `center` on its midpoint. The shaped glyph list is always in
  left-to-right visual order, so `xMm` grows monotonically.

`profile.scale` is validated and echoed in `PageGeometry`, but it changes nothing:
the page is always the cheque's own millimetre size, and a printer that needs
scaling must be handled by the print pipeline rather than by redefining the paper.
Omitting `scale` and passing `scale: 1` therefore produce byte-identical output,
which `geometry.test.ts` asserts.

### The printer offset is applied exactly once

`src/geometry.ts#resolveGeometry` is the single place that reads
`profile.dxMm`/`dyMm` (and the A4 origin) and produces the content origin. Every
other module receives absolute page coordinates. The project rule is that the
offset lives in one place so it cannot be applied twice; `resolveGeometry` is
exported and asserted by the offset tests.

---

## Arabic: joining, shaping and ordering

The pipeline is `join -> bidi -> HarfBuzz -> pdf-lib`:

1. **`src/text/joining.ts`** maps each Arabic letter to the presentation form its
   neighbours require (isolated / initial / medial / final), using the joining
   table in that file. It is data, not logic: extending it means adding the
   letter's joining class and the form code points its font spells.
2. **`bidi-js`** resolves the embedding levels and splits the string into
   same-direction runs.
3. **`harfbuzzjs`** shapes each run into glyph ids and advances, and the runs are
   concatenated into left-to-right visual order.
4. **pdf-lib** draws the glyphs; the glyph ids come from HarfBuzz, never from a
   re-layout of the string.

**Why step 1 is in TypeScript rather than in the font.** HarfBuzz chooses its
Arabic shaper from the scripts a font declares in its layout tables. This was
measured, not assumed: with the `harfbuzzjs` build used here (1.6.3, HarfBuzz
14.6.0), an empty `GSUB`, a `GSUB` holding only the `arab` script, and a full
`GSUB` with `init`/`medi`/`fina`/`isol`/`rlig` lookups were each rejected —
`Face.getTableScriptTags('GSUB')` returned no scripts and shaping produced
isolated letters — while a real font's `GSUB` placed in the same font slot is
recognised. So the joining step is explicit and testable, and a production font
that does carry an `arab` `GSUB` will additionally get HarfBuzz's own shaping on
top of the presentation forms.

---

## Fonts and licences

**The production Arabic font is not in this repository and is not bundled by this
package.** `fonts.arabic` is a required parameter: the package never downloads a
font and never fall back to one silently. A missing font is a typed
`MissingFontError`.

| Font                            | Role                                                      | Licence                                                                                          |
| ------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `test/fixtures/test-arabic.ttf` | test fixture only, **not for production**                 | generated by `tools/build-test-font.ts` in this repository; no third-party font data is included |
| the production Arabic face      | pending the project owner's approval (docs/DESIGN.md §12) | to be recorded, and echoed into the PDF metadata by `fonts.license`                              |

The fixture is built from scratch by `tools/build-test-font.ts`: 26 glyphs, one
500-unit advance, and a `cmap` that spells both the base Arabic letters and their
presentation forms. It exists so the tests can assert exact glyph ids and exact
millimetre positions without redistributing anyone else's font. Its Arabic
coverage is deliberately limited to the letters the joining table knows.

For production, embed a face whose licence permits embedding and redistribution
(OFL-1.1, Apache-2.0 or equivalent), pass its bytes as `fonts.arabic`, and set
`fonts.license` — the value is written to the PDF's `/Subject` so a printed
cheque's provenance is recorded.

### pdf-lib needs a fontkit

`pdf-lib` refuses custom font bytes until an object is registered through
`PDFDocument.registerFontkit()`, and it does not depend on `@pdf-lib/fontkit`.
That package is not installed here (this environment has no network access), so
the package ships its own adapter (`src/font/adapter.ts`) over a small TrueType
parser (`src/font/ttf.ts`) and subsetter (`src/font/subset.ts`). It implements the
interface pdf-lib actually uses: `create(data)` plus `layout`, `getGlyph`,
`glyphForCodePoint`, `createSubset` and the metric properties read by
`CustomFontEmbedder`/`CustomFontSubsetEmbedder`.

To use the real fontkit instead: add `@pdf-lib/fontkit` to the package
dependencies and replace the value passed to `registerFontkit` in
`src/pdf/fonts.ts` with it. The rest of the package is unaffected.

---

## Testing

```sh
npx vitest run                       # the repository's test runner (CI)
node tools/run-tests.ts              # same test files, no Vite/esbuild needed
npx tsc --noEmit -p tsconfig.json    # types
npx eslint .                         # lint (from the repo root)
npx prettier --check .               # format
```

The test files depend on nothing from Vitest except the `globals: true` API
(`describe`, `it`, `expect`, lifecycle hooks), so `tools/run-tests.ts` can execute
them in environments where Vitest cannot start. On this developer machine Vitest
fails before running anything:

```
failed to load config from .../vitest.config.mjs
Error: spawn EPERM
    at ensureServiceIsRunning (.../esbuild/lib/main.js:1975:29)
```

Vite bundles its config with esbuild, and esbuild starts a service process with
piped stdio, which the DSH sandbox denies. That is a documented limitation of
this machine (see the repository `AGENTS.md`), not a property of the tests. In CI
`npx vitest run` runs the same files.

### What the tests assert

| Suite               | Covers                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geometry.test.ts`  | `/MediaBox` equals the requested millimetres; one page; no scaling unless asked; A4 placement                                                           |
| `placement.test.ts` | each field's measured run start, baseline and width against the independent expectation table; alignment; one run per field; byte-for-byte determinism  |
| `offset.test.ts`    | `(0,0)`, `(±1.5,0)`, `(0,±0.8)`, `(+1.5,−0.8)` shift every field by exactly the offset; **far-apart reference distance** unchanged                      |
| `clipping.test.ts`  | page size unchanged when content overflows; overflowing runs are clipped, not moved; nothing drawn when everything is off-page                          |
| `shaping.test.ts`   | joining produces the initial/medial/final forms; the PDF stores presentation forms, not isolated letters; RTL text ends flush with the box's right edge |
| `amount.test.ts`    | figures derived from the words; both words lines printed once; closing phrase appended to the last line only                                            |
| `errors.test.ts`    | non-decimal amount, zero-width field, missing font, bad profile, bad layout, non-font bytes                                                             |
| `write.test.ts`     | the file wrapper writes exactly the in-memory bytes and leaves nothing behind                                                                           |

The placement expectations come from `test/expected-positions.ts`, which is
written from the field boxes, the printer offset and the fixture font's design.
Measurements come from the finished PDF through `test/helpers/pdf-reader.ts` — the
content stream, the EmbeddedFont `/W` array and the `/ToUnicode` CMap. The
renderer's in-memory plan is never used as the source of an expectation.

---

## Still required from the project owner

The renderer is complete and tested; these inputs are not, and the package says so
rather than guessing:

1. **The real cheque size in millimetres.** The tests use a 175 × 93 mm
   placeholder (the C0 spike's value).
2. **The seven measured field boxes** (`xMm`, `yMm`, `wMm`, `hMm`, alignment,
   point size, line height) for the Arab Bank cheque.
3. **The approved Arabic font**, with its licence, to replace the test fixture.
4. **The line-wrapping rule for the amount-in-words field.** `wrapText`
   currently distributes words as evenly as possible across `maxLines`; the rule
   must be confirmed against the paper form (and may need a width-aware wrap).
5. **The per-bank closing phrase.** Currently a single `closingPhrase` appended to
   the last words line; per-bank templates are a data change, not a code change.
6. **Whether the printer accepts the cheque size as a custom paper size**, or
   whether A4 with an origin is needed (docs/DESIGN.md §12). `paperMode` and
   `originXMm`/`originYMm` are implemented and tested for both.

Also unproven on this machine: real-size printing, and `arm64` (the deployment
architecture). Both need GitHub Actions or the owner's printer; see the repository
`AGENTS.md` for why the local sandbox cannot cover them.
