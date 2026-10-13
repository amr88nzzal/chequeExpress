import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingState } from '../components/loading-state';
import { ROUTES } from '../lib/paths';
import type { Permission } from './catalog';
import { usePermissions } from './permissions-context';

export interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
}

/**
 * Route guard. A missing permission is a 403 (CONVENTIONS.md §9): the user is
 * redirected to the forbidden page, which names the permission it wanted.
 * A record outside the scope is a different story — the API answers 404.
 */
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { can, isLoading } = usePermissions();

  // While the grants are still in flight the answer is "unknown", not
  // "forbidden" — redirecting here would flash the 403 page on every load.
  if (isLoading) return <LoadingState />;
  if (!can(permission)) {
    return <Navigate to={ROUTES.forbidden} replace state={{ permission }} />;
  }
  return <>{children}</>;
}
