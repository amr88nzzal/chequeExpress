import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from '../api/query-keys';
import type { Permission } from './catalog';
import { hasPermission } from './check';
import type { PermissionGrant, Scope } from './types';

const EMPTY_GRANTS: readonly PermissionGrant[] = [];

export interface PermissionsValue {
  grants: readonly PermissionGrant[];
  /** The company/bank-account the user is currently working in. */
  scope: Scope;
  isLoading: boolean;
  can: (permission: Permission) => boolean;
  setCompanyId: (companyId: string | undefined) => void;
}

const PermissionsContext = createContext<PermissionsValue | null>(null);

export interface PermissionsProviderProps {
  children: ReactNode;
  /**
   * Optional grants. When omitted they are fetched from the API — that is the
   * production path; tests inject them so a scenario is one object away.
   */
  grants?: readonly PermissionGrant[];
  initialCompanyId?: string;
}

export function PermissionsProvider({
  children,
  grants: grantsProp,
  initialCompanyId,
}: PermissionsProviderProps) {
  const [companyId, setCompanyId] = useState<string | undefined>(initialCompanyId);
  const currentUser = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: () => api.getCurrentUser(),
    enabled: grantsProp === undefined,
    staleTime: 5 * 60 * 1000,
  });

  const grants = grantsProp ?? currentUser.data?.grants ?? EMPTY_GRANTS;
  const scope = useMemo<Scope>(
    () => (companyId ? { kind: 'company', companyId } : { kind: 'tenant' }),
    [companyId],
  );
  const can = useCallback(
    (permission: Permission) => hasPermission(grants, permission, scope),
    [grants, scope],
  );

  const value = useMemo<PermissionsValue>(
    () => ({
      grants,
      scope,
      isLoading: grantsProp === undefined && currentUser.isLoading,
      can,
      setCompanyId,
    }),
    [grants, scope, grantsProp, currentUser.isLoading, can],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionsValue {
  const value = useContext(PermissionsContext);
  if (!value) {
    throw new Error('usePermissions must be used inside a PermissionsProvider');
  }
  return value;
}

export { PermissionsContext };
