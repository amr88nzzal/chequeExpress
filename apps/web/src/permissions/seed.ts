import { ALL_PERMISSIONS, PERMISSIONS } from './catalog';
import type { PermissionGrant, RoleName } from './types';

/**
 * The three seed roles of CONVENTIONS.md §9, expressed as *data*: a role is
 * nothing but a list of grants. Removing or adding a permission changes these
 * lists, never a component.
 */
export const SEED_ROLES: Readonly<Record<RoleName, readonly PermissionGrant[]>> = {
  admin: ALL_PERMISSIONS.map((permission) => ({ permission, scope: { kind: 'tenant' } })),
  issuer: [
    { permission: PERMISSIONS.issuedView, scope: { kind: 'tenant' } },
    { permission: PERMISSIONS.issuedCreate, scope: { kind: 'tenant' } },
    { permission: PERMISSIONS.issuedPrint, scope: { kind: 'tenant' } },
  ],
  follower: [
    { permission: PERMISSIONS.issuedView, scope: { kind: 'tenant' } },
    { permission: PERMISSIONS.receivedView, scope: { kind: 'tenant' } },
    // Deliberately narrow: reports only for one company, so the demo shows the
    // company switcher hiding a destination instead of just disabling a button.
    { permission: PERMISSIONS.reportsView, scope: { kind: 'company', companyId: 'cmp-arabi' } },
  ],
};

export function grantsForRole(role: RoleName): PermissionGrant[] {
  return SEED_ROLES[role].map((grant) => ({ ...grant }));
}
