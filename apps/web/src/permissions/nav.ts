import { ROUTES } from '../lib/paths';
import { PERMISSIONS, type Permission } from './catalog';
import { hasPermission } from './check';
import type { PermissionGrant, Scope } from './types';

/**
 * Navigation is *derived from permissions*, never from role names
 * (CONVENTIONS.md §16): a destination exists in the sidebar exactly when the
 * permission it needs is held on the active scope.
 */
export interface NavDestination {
  id: string;
  path: string;
  permission: Permission;
  labelKey: string;
  section: NavSectionId;
}

export type NavSectionId = 'main' | 'administration';

export interface NavSection {
  id: NavSectionId;
  labelKey: string;
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { id: 'main', labelKey: 'nav.main' },
  { id: 'administration', labelKey: 'nav.administration' },
];

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    id: 'issued',
    path: ROUTES.issued,
    permission: PERMISSIONS.issuedView,
    labelKey: 'nav.issued',
    section: 'main',
  },
  {
    id: 'create-draft',
    path: ROUTES.createDraft,
    permission: PERMISSIONS.issuedCreate,
    labelKey: 'nav.createDraft',
    section: 'main',
  },
  {
    id: 'print',
    path: ROUTES.print,
    permission: PERMISSIONS.issuedPrint,
    labelKey: 'nav.print',
    section: 'main',
  },
  {
    id: 'received',
    path: '/received',
    permission: PERMISSIONS.receivedView,
    labelKey: 'nav.received',
    section: 'main',
  },
  {
    id: 'reports',
    path: '/reports',
    permission: PERMISSIONS.reportsView,
    labelKey: 'nav.reports',
    section: 'administration',
  },
  {
    id: 'settings',
    path: '/settings',
    permission: PERMISSIONS.settingsManage,
    labelKey: 'nav.settings',
    section: 'administration',
  },
];

/** Destinations the user may reach on the active scope, in declaration order. */
export function visibleDestinations(
  grants: readonly PermissionGrant[],
  activeScope: Scope,
): NavDestination[] {
  return NAV_DESTINATIONS.filter((destination) =>
    hasPermission(grants, destination.permission, activeScope),
  );
}

export function destinationsInSection(
  destinations: readonly NavDestination[],
  section: NavSectionId,
): NavDestination[] {
  return destinations.filter((destination) => destination.section === section);
}
