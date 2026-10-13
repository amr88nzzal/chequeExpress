/**
 * Permission constants (CONVENTIONS.md §9). The identical list has to live in
 * `packages/shared` for `apps/api`; until that package exists this module is the
 * single source the UI reads from. Naming: `cheques.<resource>.<action>`.
 */
export const PERMISSIONS = {
  issuedView: 'cheques.issued.view',
  issuedCreate: 'cheques.issued.create',
  issuedPrint: 'cheques.issued.print',
  issuedDeliver: 'cheques.issued.deliver',
  receivedView: 'cheques.received.view',
  reportsView: 'cheques.reports.view',
  settingsManage: 'cheques.settings.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

/**
 * `cheques.issued.print` -> `permissions.cheques.issued.print`.
 * Deriving the key keeps the permission list and the i18n bundles from drifting:
 * every permission has a label, and `tsc` proves both languages have it.
 */
export function permissionLabelKey(permission: Permission): string {
  return `permissions.${permission}`;
}
