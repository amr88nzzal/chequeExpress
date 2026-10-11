# Spike C0-1: HTML → PDF at exact cheque size (throwaway, Python + Playwright)

Purpose: prove the approach before writing the real Node module (`packages/cheque-render`).
Run: `pip install playwright numpy pillow && playwright install chromium && python geometry_test.py` (needs `pdftoppm`/`pdfinfo` from poppler).
`words.json` was produced with `packages/words` (sample amounts from the Excel sheet).

## Result (x86_64 sandbox, Chromium 141, DejaVu Sans): 21/21 checks pass
- Page size = requested size, **rounded to whole CSS pixels** (93 mm came out 93.13 mm, ±0.26 mm). Content is anchored top-left, so field positions are unaffected.
- Reference marks land within 0.13 mm of their exact mm position (test tolerance 0.2 mm).
- Arabic shaping is correct, the font is embedded and subsetted, text sits inside its field box and honours left/right/center alignment.
- **Printer offset (dx, dy) works to ±0.1 mm.**

## Pitfall found (must be in the real implementation)
If shifted content overflows the page (offset > 0), Chromium **shrink-to-fits the whole page** and silently scales everything (measured: ~0.8% too small). Fix used here: put the sheet inside a fixed-size `overflow:hidden` container. Keep the geometry test with a non-zero offset in CI.

## Not covered (still open)
- arm64 (the production server): Chromium + fonts must be re-tested inside the arm64 container.
- Real cheque size (PLACEHOLDER 175 × 93 mm) and real Arabic print fonts (DejaVu Sans was the only Arabic-capable font available here).
- Real printer behaviour (margins, paper path). See DESIGN.md §5.2.
