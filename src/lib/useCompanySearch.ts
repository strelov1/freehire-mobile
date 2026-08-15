import { useInfiniteQuery } from '@tanstack/react-query';

import { listCompanies } from './api';
import { COMPANY_PAGE_SIZE, nextCompanyOffset, type CompanySort } from './companyList';
import { publicKeys } from './queryKeys';

/**
 * The company directory as an infinite query. `settledQuery` is the DEBOUNCED
 * search text, not what the field currently holds — it keys the cache, so
 * passing the raw text would spawn a cache entry and a request per keystroke.
 * Changing either it or the sort swaps entries, which resets pagination to the
 * first page on its own.
 */
export function useCompanySearch(settledQuery: string, sort: CompanySort) {
  return useInfiniteQuery({
    queryKey: publicKeys.companies.search(settledQuery, sort),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listCompanies(settledQuery, sort, COMPANY_PAGE_SIZE, pageParam, signal),
    getNextPageParam: nextCompanyOffset,
  });
}
