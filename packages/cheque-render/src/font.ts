import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const FONT_FAMILY = 'Noto Naskh Arabic';

const require = createRequire(import.meta.url);
let cached: string | undefined;

/**
 * @font-face rules with the font embedded as data URLs, so rendering never depends on fonts installed
 * on the server (arm64 image or developer machine). Only the arabic and latin subsets, weights 400 and 700.
 */
export const embeddedFontCss = (): string => {
  if (cached) return cached;
  const pkgDir = dirname(require.resolve('@fontsource/noto-naskh-arabic/package.json'));
  const blocks: string[] = [];
  for (const weight of [400, 700]) {
    const css = readFileSync(join(pkgDir, `${weight}.css`), 'utf8');
    for (const block of css.split('@font-face').slice(1)) {
      const m = /url\(\.\/files\/(noto-naskh-arabic-(?:arabic|latin)-\d+-normal)\.woff2\)/.exec(
        block,
      );
      if (!m) continue;
      const data = readFileSync(join(pkgDir, 'files', `${m[1]}.woff2`)).toString('base64');
      const range = /unicode-range:([^;]+);/.exec(block)?.[1]?.trim();
      blocks.push(
        `@font-face{font-family:'${FONT_FAMILY}';font-style:normal;font-weight:${weight};` +
          `src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${range};}`,
      );
    }
  }
  if (blocks.length !== 4) throw new Error(`expected 4 font faces, found ${blocks.length}`);
  cached = blocks.join('\n');
  return cached;
};
