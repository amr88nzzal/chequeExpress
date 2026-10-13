import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ar } from './locales/ar';
import { en } from './locales/en';
import {
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  readStoredLanguage,
  storeLanguage,
  SUPPORTED_LANGUAGES,
  type Language,
} from '../lib/language';

export const resources = {
  ar: { translation: ar },
  en: { translation: en },
} as const;

export const i18nNamespaces = ['translation'] as const;

/**
 * `initImmediate: false` makes `init` synchronous when resources are inlined,
 * so `useTranslation` has its bundle on the very first render — no flash of
 * raw keys and no async setup in tests.
 */
void i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  defaultNS: 'translation',
  ns: [...i18nNamespaces],
  interpolation: { escapeValue: false },
  initImmediate: false,
  returnNull: false,
  react: { useSuspense: false },
});

export function currentLanguage(): Language {
  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
}

/** Switches the language and persists the choice; direction follows the language. */
export async function setLanguage(language: Language): Promise<void> {
  storeLanguage(language);
  await i18n.changeLanguage(language);
}

export default i18n;
