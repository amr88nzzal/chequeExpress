// Mantine's own stylesheet first; since v7 every component ships its RTL rules
// in `styles.css` (there is no separate `styles.rtl.css`), and the direction is
// driven by `DirectionProvider` below.
import '@mantine/core/styles.css';
import '../styles/app.css';

import { useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DirectionProvider, MantineProvider, createTheme, useDirection } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { settingsForLanguage } from '../config/settings';
import { SettingsProvider } from '../config/settings-context';
import { directionForLanguage, normalizeLanguage, type Direction } from '../lib/language';
import { PermissionsProvider } from '../permissions/permissions-context';
import type { PermissionGrant } from '../permissions/types';

const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
});

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export interface AppProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
  /** Test seam: inject the grants instead of fetching `/me`. */
  permissions?: readonly PermissionGrant[];
  initialCompanyId?: string;
}

export function AppProviders({
  children,
  queryClient,
  permissions,
  initialCompanyId,
}: AppProvidersProps) {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage);
  const settings = settingsForLanguage(language);
  const client = useMemo(() => queryClient ?? createQueryClient(), [queryClient]);

  // The document element carries the direction, so CSS logical properties and
  // `[dir='rtl']` selectors work for anything rendered outside the React tree
  // (portals, the browser's own scrollbars).
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', language);
    root.setAttribute('dir', directionForLanguage(language));
    document.title = t('app.title');
  }, [language, t]);

  return (
    // Mantine 7.17 exposes `initialDirection` (there is no `dir` prop) and only
    // *detects* the root `dir` attribute on mount, so the live direction is kept
    // in sync by `DirectionController` below.
    <DirectionProvider initialDirection={settings.direction} detectDirection={false}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <DirectionController direction={settings.direction} />
        <QueryClientProvider client={client}>
          <SettingsProvider value={settings}>
            <PermissionsProvider grants={permissions} initialCompanyId={initialCompanyId}>
              {children}
            </PermissionsProvider>
          </SettingsProvider>
        </QueryClientProvider>
      </MantineProvider>
    </DirectionProvider>
  );
}

/** Pushes the language-derived direction into Mantine's context on every change. */
function DirectionController({ direction }: { direction: Direction }) {
  const { dir, setDirection } = useDirection();

  useEffect(() => {
    if (dir !== direction) setDirection(direction);
  }, [dir, direction, setDirection]);

  return null;
}
