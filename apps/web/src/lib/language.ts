export const SUPPORTED_LANGUAGES = ['ar', 'en'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type Direction = 'rtl' | 'ltr';

export const DEFAULT_LANGUAGE: Language = 'ar';

export const LANGUAGE_STORAGE_KEY = 'chequesExpress.language';

const RTL_LANGUAGES: readonly string[] = ['ar', 'fa', 'he', 'ur'];

export function isSupportedLanguage(value: string | null | undefined): value is Language {
  return (
    value !== null && value !== undefined && SUPPORTED_LANGUAGES.some((code) => code === value)
  );
}

export function normalizeLanguage(value: string | null | undefined): Language {
  if (isSupportedLanguage(value)) return value;
  // i18next may report `ar-JO` or `en-US`; the base subtag is what we ship.
  const base = value?.split('-')[0];
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}

export function directionForLanguage(value: string | null | undefined): Direction {
  return RTL_LANGUAGES.includes(normalizeLanguage(value)) ? 'rtl' : 'ltr';
}

/**
 * `localStorage` is absent in a bare Node process and can throw in private
 * browsing modes, so every access is guarded instead of assumed.
 */
export function readStoredLanguage(storage: Storage | undefined = defaultStorage()): Language {
  if (!storage) return DEFAULT_LANGUAGE;
  try {
    return normalizeLanguage(storage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function storeLanguage(
  language: Language,
  storage: Storage | undefined = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Persistence is best effort: a blocked storage must not break the toggle.
  }
}

function defaultStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
