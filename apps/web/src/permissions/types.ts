/**
 * Permissions and scope (CONVENTIONS.md §9).
 *
 * A grant is a permission *plus the scope it was granted on*: the whole tenant
 * (all companies), one company, or one bank account. Screens never ask for a
 * role name — they ask whether a permission is held on the active scope.
 */

import type { Permission } from './catalog';

export type Scope =
  | { kind: 'tenant' }
  | { kind: 'company'; companyId: string }
  | { kind: 'bankAccount'; companyId: string; bankAccountId: string };

export interface PermissionGrant {
  permission: Permission;
  scope: Scope;
}

/** Seed templates only (`identity.roles`); the UI must never branch on them. */
export type RoleName = 'admin' | 'issuer' | 'follower';
