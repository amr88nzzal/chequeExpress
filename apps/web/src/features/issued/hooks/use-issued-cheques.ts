import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/query-keys';
import type { ChequeStatus, IssuedCheque, IssuedChequeQuery } from '../../../api/types';

/** The filter shape the list screen owns; paging is appended by the hook. */
export interface IssuedChequeFilters {
  status: ChequeStatus | null;
  dueDateFrom: string | null;
  dueDateTo: string | null;
  bankAccountId: string | null;
  partyId: string | null;
}

export const EMPTY_ISSUED_FILTERS: IssuedChequeFilters = {
  status: null,
  dueDateFrom: null,
  dueDateTo: null,
  bankAccountId: null,
  partyId: null,
};

/**
 * Cursor paging (CONVENTIONS.md §13): the server returns `nextCursor` and the
 * client only echoes it back. No offsets, no total-count arithmetic in the UI.
 */
export function useIssuedCheques(filters: IssuedChequeFilters, companyId: string | null) {
  const query: IssuedChequeQuery = {
    ...filters,
    companyId,
    limit: 10,
  };

  return useInfiniteQuery({
    queryKey: queryKeys.issuedCheques({ ...query, cursor: null }),
    queryFn: ({ pageParam }) => api.listIssuedCheques({ ...query, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (result) => ({
      items: result.pages.flatMap((page) => page.items) as IssuedCheque[],
      total: result.pages.at(-1)?.total ?? null,
    }),
  });
}
