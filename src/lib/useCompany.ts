import { useQuery } from '@tanstack/react-query';

import { getCompany } from './api';

/**
 * A single company by slug, for the company screen. Keyed on the slug so
 * navigating between companies caches each independently. Disabled until a
 * slug is present (the route param can be momentarily undefined on mount).
 */
export function useCompany(slug: string | undefined) {
  return useQuery({
    queryKey: ['companies', 'detail', slug],
    queryFn: () => getCompany(slug as string),
    enabled: !!slug,
  });
}
