import { useTranslation } from 'react-i18next';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import type { QueryClient } from '@tanstack/react-query';
import { AppErrorBoundary } from '../components/app-error-boundary';
import { AppShell } from '../components/app-shell';
import { directionForLanguage } from '../lib/language';
import type { PermissionGrant } from '../permissions/types';
import { AppProviders } from './providers';
import { AppRoutes } from './routes';

export interface AppRootProps {
  /**
   * `memory` is what tests use: jsdom has no history to speak of, and memory
   * routing lets a test start on any screen without a navigation step.
   */
  router?: 'browser' | 'memory';
  initialEntries?: string[];
  permissions?: readonly PermissionGrant[];
  queryClient?: QueryClient;
  initialCompanyId?: string;
}

/**
 * The whole application in one composition, used by both `main.tsx` and the
 * tests — so what the tests render is what the browser renders.
 */
export function AppRoot({
  router = 'browser',
  initialEntries,
  permissions,
  queryClient,
  initialCompanyId,
}: AppRootProps) {
  return (
    <AppProviders
      queryClient={queryClient}
      permissions={permissions}
      initialCompanyId={initialCompanyId}
    >
      <AppFrame router={router} initialEntries={initialEntries} />
    </AppProviders>
  );
}

function AppFrame({
  router,
  initialEntries,
}: {
  router: 'browser' | 'memory';
  initialEntries?: string[];
}) {
  const { i18n } = useTranslation();
  const direction = directionForLanguage(i18n.resolvedLanguage);

  return (
    <div dir={direction} data-testid="app-root" className="app-root">
      {router === 'memory' ? (
        <MemoryRouter initialEntries={initialEntries}>
          <ShellAndRoutes />
        </MemoryRouter>
      ) : (
        <BrowserRouter>
          <ShellAndRoutes />
        </BrowserRouter>
      )}
    </div>
  );
}

function ShellAndRoutes() {
  return (
    <AppShell>
      <AppErrorBoundary>
        <AppRoutes />
      </AppErrorBoundary>
    </AppShell>
  );
}
