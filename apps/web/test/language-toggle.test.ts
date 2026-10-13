// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderApp } from './test-utils';
import { ar } from '../src/i18n/locales/ar';
import { en } from '../src/i18n/locales/en';
import { readStoredLanguage, LANGUAGE_STORAGE_KEY } from '../src/lib/language';
import { grantsForRole } from '../src/permissions/seed';

const ADMIN = grantsForRole('admin');

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('language toggle', () => {
  it('switches Arabic to English, flips the direction and persists the choice', async () => {
    await renderApp({ language: 'ar', route: '/issued', permissions: ADMIN });

    expect(screen.getByTestId('app-root').getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('heading', { name: ar.issued.list.title })).toBeTruthy();
    expect(readStoredLanguage()).toBe('ar');

    fireEvent.click(screen.getByRole('button', { name: ar.language.en }));

    await waitFor(() => {
      expect(screen.getByTestId('app-root').getAttribute('dir')).toBe('ltr');
    });

    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(screen.getByRole('heading', { name: en.issued.list.title })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: ar.issued.list.title })).toBeNull();

    // The nav label is re-translated too, not just the page title.
    expect(screen.getByRole('link', { name: en.nav.issued })).toBeTruthy();
    // And the filter controls follow the new language.
    expect(screen.getByRole('textbox', { name: en.issued.list.filters.status })).toBeTruthy();

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(readStoredLanguage()).toBe('en');
  });

  it('switches back to Arabic and restores RTL', async () => {
    await renderApp({ language: 'en', route: '/issued', permissions: ADMIN });

    expect(screen.getByTestId('app-root').getAttribute('dir')).toBe('ltr');

    fireEvent.click(screen.getByRole('button', { name: en.language.ar }));

    await waitFor(() => {
      expect(screen.getByTestId('app-root').getAttribute('dir')).toBe('rtl');
    });
    expect(screen.getByRole('heading', { name: ar.issued.list.title })).toBeTruthy();
    expect(readStoredLanguage()).toBe('ar');
  });
});
