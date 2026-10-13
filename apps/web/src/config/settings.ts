import { DEFAULT_CURRENCY } from './currencies';
import type { Direction, Language } from '../lib/language';

/**
 * Display settings. CONVENTIONS.md §16: numbers, dates and currencies are
 * formatted from settings, never by hand. These values are the local defaults;
 * in the real system they arrive with the tenant/company profile from
 * `apps/api` and are exposed through `SettingsProvider`.
 */
export interface FormatSettings {
  language: Language;
  locale: string;
  direction: Direction;
  /** Zone used for *instants* (created_at, printed_at). Date-only values carry no zone. */
  timeZone: string;
  defaultCurrency: string;
  groupSeparator: string;
  decimalSeparator: string;
}

export const APP_SETTINGS: Readonly<Record<Language, FormatSettings>> = {
  ar: {
    language: 'ar',
    // `-u-nu-latn` keeps Arabic-Indic digits out of money and dates: cheque
    // forms in Jordan are printed with Western digits, only the labels are Arabic.
    locale: 'ar-JO-u-nu-latn',
    direction: 'rtl',
    timeZone: 'Asia/Amman',
    defaultCurrency: DEFAULT_CURRENCY,
    groupSeparator: ',',
    decimalSeparator: '.',
  },
  en: {
    language: 'en',
    locale: 'en-JO',
    direction: 'ltr',
    timeZone: 'Asia/Amman',
    defaultCurrency: DEFAULT_CURRENCY,
    groupSeparator: ',',
    decimalSeparator: '.',
  },
};

export function settingsForLanguage(language: Language): FormatSettings {
  return APP_SETTINGS[language];
}
