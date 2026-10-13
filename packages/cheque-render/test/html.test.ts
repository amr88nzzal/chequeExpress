import { describe, expect, it } from 'vitest';
import { buildChequeHtml, DEFAULT_PROFILE, PLACEHOLDER_LAYOUT } from '../src/index.ts';

const base = { layout: PLACEHOLDER_LAYOUT, values: { payee: 'a<b>&"c' } };

describe('buildChequeHtml (no browser needed)', () => {
  it('escapes field text', () => {
    const html = buildChequeHtml(base);
    expect(html).toContain('a&lt;b&gt;&amp;&quot;c');
    expect(html).not.toContain('a<b>');
  });

  it('puts the sheet inside an overflow:hidden clip of exactly the page size', () => {
    const html = buildChequeHtml({ ...base, profile: { ...DEFAULT_PROFILE, offsetXMm: 3 } });
    expect(html).toMatch(/\.clip \{[^}]*width: 175mm; height: 93mm; overflow: hidden/);
    expect(html).toMatch(/\.sheet \{ position: absolute; left: 3mm; top: 0mm/);
  });

  it('print mode has no background image and no frames; preview adds them', () => {
    const layout = { ...PLACEHOLDER_LAYOUT, backgroundDataUrl: 'data:image/png;base64,AAAA' };
    const print = buildChequeHtml({ layout, values: {} });
    const preview = buildChequeHtml({ layout, values: {}, options: { mode: 'preview' } });
    expect(print).not.toContain('<img');
    expect(print).not.toContain('class="frame"');
    expect(preview).toContain('<img class="bg"');
    expect(preview).toContain('class="frame"');
  });

  it('rejects invalid geometry', () => {
    expect(() => buildChequeHtml({ ...base, profile: { ...DEFAULT_PROFILE, scale: 3 } })).toThrow(
      /scale/,
    );
    expect(() =>
      buildChequeHtml({ ...base, profile: { ...DEFAULT_PROFILE, offsetXMm: NaN } }),
    ).toThrow(/offset/);
    expect(() =>
      buildChequeHtml({ layout: { ...PLACEHOLDER_LAYOUT, widthMm: 0 }, values: {} }),
    ).toThrow(/size/);
  });
});
