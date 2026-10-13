import type { ReactNode } from 'react';
import type { Permission } from './catalog';
import { usePermissions } from './permissions-context';

export interface CanProps {
  permission: Permission;
  /** Rendered when the permission is not held; `null` by default. */
  fallback?: ReactNode;
  children: ReactNode;
}

/** Renders its children only when the permission is held on the active scope. */
export function Can({ permission, fallback = null, children }: CanProps) {
  const { can } = usePermissions();
  return <>{can(permission) ? children : fallback}</>;
}
