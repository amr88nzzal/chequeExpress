import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from '../api/query-keys';

/**
 * Reference data shared by the list screen (filters), the draft form (selects)
 * and the header (company switcher).
 */

export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.companies,
    queryFn: () => api.listCompanies(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useBankAccounts(companyId: string | null) {
  return useQuery({
    queryKey: queryKeys.bankAccounts(companyId),
    queryFn: () => api.listBankAccounts(companyId),
    staleTime: 10 * 60 * 1000,
  });
}

export function useParties(companyId: string | null) {
  return useQuery({
    queryKey: queryKeys.parties(companyId),
    queryFn: () => api.listParties(companyId),
    staleTime: 10 * 60 * 1000,
  });
}
