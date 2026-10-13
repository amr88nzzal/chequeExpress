import { useTranslation } from 'react-i18next';
import { Button, Group } from '@mantine/core';
import { setLanguage } from '../i18n';
import { normalizeLanguage, SUPPORTED_LANGUAGES, type Language } from '../lib/language';

/**
 * Switches between Arabic and English. The direction is derived from the
 * language (`directionForLanguage`), and the choice is persisted in
 * `localStorage`; `AppProviders` re-applies `<html lang dir>` on every change.
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage);

  return (
    <Group gap={4} role="group" aria-label={t('language.label')} wrap="nowrap">
      {SUPPORTED_LANGUAGES.map((code: Language) => (
        <Button
          key={code}
          size="compact-sm"
          variant={code === language ? 'filled' : 'default'}
          aria-pressed={code === language}
          onClick={() => {
            void setLanguage(code);
          }}
        >
          {t(`language.${code}`)}
        </Button>
      ))}
    </Group>
  );
}
