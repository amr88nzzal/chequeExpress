// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderApp } from './test-utils';
import { ar } from '../src/i18n/locales/ar';
import { en } from '../src/i18n/locales/en';
import { grantsForRole } from '../src/permissions/seed';

afterEach(cleanup);

/** The full-permission seed role, so this suite is only about rendering. */
const ADMIN = grantsForRole('admin');
const SLOW_QUERY = { timeout: 5_000 };

describe('Arabic screen direction', () => {
  it('renders with dir="rtl" on the app root and the document element', async () => {
    await renderApp({ language: 'ar', route: '/issued', permissions: ADMIN });

    expect(screen.getByTestId('app-root').getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
  });

  it('shows Arabic labels, not keys and not English', async () => {
    await renderApp({ language: 'ar', route: '/issued', permissions: ADMIN });

    expect(screen.getByRole('heading', { name: ar.issued.list.title })).toBeTruthy();
    expect(screen.getByText(ar.issued.list.subtitle)).toBeTruthy();
    expect(screen.getByRole('link', { name: ar.nav.issued })).toBeTruthy();
    expect(screen.getByRole('button', { name: ar.language.en })).toBeTruthy();
    // A filter control: its label and its listbox share the same accessible name.
    expect(screen.getByRole('textbox', { name: ar.issued.list.filters.status })).toBeTruthy();

    // No raw i18n key leaked into the DOM and no English label was rendered.
    expect(screen.queryByText('issued.list.title')).toBeNull();
    expect(screen.queryByText(en.issued.list.title)).toBeNull();
    expect(screen.queryByText(en.nav.issued)).toBeNull();
  });

  it('translates the status enum through issued.status.*', async () => {
    await renderApp({ language: 'ar', route: '/issued', permissions: ADMIN });

    // The fixture set always contains at least one draft, so this exercises the
    // enum translation, not just a static label.
    expect(
      (await screen.findAllByText(ar.issued.status.draft, {}, SLOW_QUERY)).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(en.issued.status.draft)).toBeNull();
  });
});
