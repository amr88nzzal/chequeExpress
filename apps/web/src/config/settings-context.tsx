import { createContext, useContext, type ReactNode } from 'react';
import { APP_SETTINGS, type FormatSettings } from './settings';
import { DEFAULT_LANGUAGE } from '../lib/language';

const SettingsContext = createContext<FormatSettings>(APP_SETTINGS[DEFAULT_LANGUAGE]);

export interface SettingsProviderProps {
  value: FormatSettings;
  children: ReactNode;
}

export function SettingsProvider({ value, children }: SettingsProviderProps) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useFormatSettings(): FormatSettings {
  return useContext(SettingsContext);
}
