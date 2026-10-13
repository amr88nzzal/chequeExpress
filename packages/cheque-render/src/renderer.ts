import { chromium, type Browser } from 'playwright-core';
import { buildChequeHtml, pageSizeMm } from './html.ts';
import type { RenderInput } from './types.ts';

export type LaunchOptions = {
  /** Default: CHEQUE_CHROMIUM_PATH, else the Chromium installed by `playwright-core install chromium`. */
  executablePath?: string;
  /** Needed inside most containers. Default: CHEQUE_NO_SANDBOX=1. */
  noSandbox?: boolean;
};

/** One long-lived Chromium; every render uses a fresh page. */
export class ChequeRenderer {
  private readonly browser: Browser;

  private constructor(browser: Browser) {
    this.browser = browser;
  }

  static async launch(options: LaunchOptions = {}): Promise<ChequeRenderer> {
    const executablePath =
      options.executablePath ?? process.env['CHEQUE_CHROMIUM_PATH'] ?? undefined;
    const noSandbox = options.noSandbox ?? process.env['CHEQUE_NO_SANDBOX'] === '1';
    const browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [...(noSandbox ? ['--no-sandbox'] : []), '--disable-gpu', '--font-render-hinting=none'],
    });
    return new ChequeRenderer(browser);
  }

  /** PDF whose page is exactly the cheque (or A4), zero margins, no scaling. */
  async renderPdf(input: RenderInput): Promise<Buffer> {
    const html = buildChequeHtml(input);
    const size = pageSizeMm(input);
    const page = await this.browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate('document.fonts.ready');
      await page.emulateMedia({ media: 'print' });
      return await page.pdf({
        width: `${size.width}mm`,
        height: `${size.height}mm`,
        preferCSSPageSize: true,
        printBackground: true, // marks are CSS backgrounds; print mode has no other backgrounds
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}
