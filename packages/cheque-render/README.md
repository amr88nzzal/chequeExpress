# @cheques/cheque-render

Cheque data in, PDF out: the page is exactly the cheque (mm), text only, Arabic font embedded (Noto Naskh Arabic).

```ts
const renderer = await ChequeRenderer.launch();           // one Chromium, many renders
const pdf = await renderer.renderPdf({
  layout: PLACEHOLDER_LAYOUT,                              // size + field boxes in mm (placeholder until measured)
  values: { payee: '...', amtMain: '3355' },               // already formatted text
  profile: { offsetXMm: 0.4, offsetYMm: -0.2, scale: 1, paper: { kind: 'custom' } },
  options: { mode: 'print' },                              // 'preview' adds the background scan and field frames
});
```
Paper modes: `custom` (page = cheque, manual tray) or `a4` (A4 landscape, cheque corner at `originXMm, originYMm`).
`pnpm --filter @cheques/cheque-render sample out.pdf preview` writes a sample.

## Tests
Need Chromium and poppler (`pdftoppm`, `pdfinfo`, `pdffonts`).
- CI: installs both. Locally: `npx playwright-core install chromium`, and `apt install poppler-utils`.
- `CHEQUE_CHROMIUM_PATH` selects a specific Chromium; `CHEQUE_NO_SANDBOX=1` is needed inside containers and as root.

### On the arm64 server (official Playwright image, matches the pinned playwright-core 1.64.0)
```
cd ~/chequeExpress
docker run --rm --ipc=host -v "$PWD":/app -w /app mcr.microsoft.com/playwright:v1.64.0-noble sh -c \
  "apt-get update -qq && apt-get install -y -qq poppler-utils && npm i -g pnpm@12.11.2 && \
   pnpm install --frozen-lockfile && CHEQUE_NO_SANDBOX=1 pnpm --filter @cheques/cheque-render test"
```
Expected: `Tests 12 passed (12)`.

## Known limits
- Layout size and field positions are PLACEHOLDER values; real printing needs the measured cheque and a calibrated printer profile.
- Latin digits and dates come from the Latin glyphs of Noto Naskh Arabic (a serif look). Say if the cheque needs sans-serif digits like Arial.
- Text that is too long for its field is clipped, not shrunk. Fit rules come with the real layout.
