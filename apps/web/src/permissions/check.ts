import type { Permission } from './catalog';
import type { PermissionGrant, Scope } from './types';

/**
 * Does a grant made on `grantedScope` reach the scope the user is currently
 * working in? A tenant-wide grant covers everything; a company grant covers
 * that company and any of its bank accounts; a bank-account grant covers only
 * that account.
 */
export function scopeCovers(grantedScope: Scope, activeScope: Scope): boolean {
  switch (grantedScope.kind) {
    case 'tenant':
      return true;
    case 'company':
      if (activeScope.kind === 'tenant') return false;
      return activeScope.companyId === grantedScope.companyId;
    case 'bankAccount':
      return (
        activeScope.kind === 'bankAccount' &&
        activeScope.bankAccountId === grantedScope.bankAccountId
      );
    default:
      return false;
  }
}

export function hasPermission(
  grants: readonly PermissionGrant[],
  permission: Permission,
  activeScope: Scope,
): boolean {
  return grants.some(
    (grant) => grant.permission === permission && scopeCovers(grant.scope, activeScope),
  );
}

export function grantedPermissions(
  grants: readonly PermissionGrant[],
  activeScope: Scope,
): Permission[] {
  const reachable = grants.filter((grant) => scopeCovers(grant.scope, activeScope));
  return [...new Set(reachable.map((grant) => grant.permission))];
}
