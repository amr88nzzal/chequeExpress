/**
 * Shared test harness.
 *
 * Two rules make the suite configuration-independent (so it also runs under the
 * repository root `vitest.config.ts`, whose `include` only matches `.test.ts`):
 *   • every test file declares `// @vitest-environment jsdom` itself;
 *   • every test imports this module, which installs the DOM polyfills Mantine
 *     needs and composes the *production* provider tree (`AppProviders`).
 */
import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { AppProviders } from '../src/app/providers';
import { AppRoot, type AppRootProps } from '../src/app/app-root';
import { setLanguage } from '../src/i18n';
import type { Language } from '../src/lib/language';

function defineGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { writable: true, configurable: true, value });
}

class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class StubIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}

function installDomPolyfills(): void {
  if (typeof window === 'undefined') return;

  if (typeof window.matchMedia !== 'function') {
    defineGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  }

  if (!('ResizeObserver' in globalThis)) defineGlobal('ResizeObserver', StubResizeObserver);
  if (!('IntersectionObserver' in globalThis)) {
    defineGlobal('IntersectionObserver', StubIntersectionObserver);
  }
  if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
}

installDomPolyfills();

export interface RenderAppOptions extends Omit<AppRootProps, 'router'> {
  /** Language the test starts in; also written to `localStorage` like the real toggle. */
  language?: Language;
  route?: string;
}

/** Renders the whole application (shell + routes) in a memory router. */
export async function renderApp({
  language = 'ar',
  route = '/issued',
  ...rest
}: RenderAppOptions = {}): Promise<RenderResult> {
  await setLanguage(language);
  return render(<AppRoot router="memory" initialEntries={[route]} {...rest} />);
}

/** Renders a single component inside the real provider tree (no router). */
export async function renderWithProviders(
  ui: ReactElement,
  { language = 'ar' }: { language?: Language } = {},
): Promise<RenderResult> {
  await setLanguage(language);
  return render(<AppProviders>{ui}</AppProviders>);
}

export { StubResizeObserver, StubIntersectionObserver };
