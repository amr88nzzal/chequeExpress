/**
 * TanStack Query keys in one place: components never build a key by hand, so
 * invalidation and cache sharing stay predictable.
 */
const issuedChequesPrefix = ['issued-cheques'] as const;

export const queryKeys = {
  /** Covers every page/filter combination — use it to invalidate the whole list. */
  issuedChequesAll: issuedChequesPrefix,
  issuedCheques: (filters: Readonly<Record<string, unknown>>) =>
    [...issuedChequesPrefix, filters] as const,
  currentUser: ['current-user'] as const,
  companies: ['companies'] as const,
  bankAccounts: (companyId: string | null) => ['bank-accounts', companyId] as const,
  parties: (companyId: string | null) => ['parties', companyId] as const,
  printContext: (chequeId: string | null) => ['print-context', chequeId] as const,
};
