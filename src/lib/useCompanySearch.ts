import { useInfiniteQuery } from '@tanstack/react-query';

import { listCompanies } from './api';
import { COMPANY_PAGE_SIZE, nextCompanyOffset } from './companyList';
import { publicKeys } from './queryKeys';

/**
 * The company directory as an infinite query. `settledQuery` is the DEBOUNCED
 * search text, not what the field currently holds — it keys the cache, so
 * passing the raw text would spawn a cache entry and a request per keystroke.
 * Changing it swaps entries, which resets pagination to the first page on its
 * own.
 */
export function useCompanySearch(settledQuery: string) {
  return useInfiniteQuery({
    queryKey: publicKeys.companies.search(settledQuery),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listCompanies(settledQuery, COMPANY_PAGE_SIZE, pageParam, signal),
    getNextPageParam: nextCompanyOffset,
    // Hold the last result on screen while the next one loads, instead of
    // dropping to a full-screen spinner on every settled keystroke. `isLoading`
    // stays true only until the FIRST page exists, which is the one moment the
    // screen has nothing to show. Same idiom as `useFacetCounts`.
    placeholderData: (prev) => prev,
  });
}
