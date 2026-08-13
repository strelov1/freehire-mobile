import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { dismissedSlugs, dismissJob } from './api';
import { useAuth } from './authStore';

/**
 * The signed-in user's hidden-job set plus a hide mutation. Sibling of
 * `useSavedJobs`: same shape (queried once, keyed `['dismissed']`, optimistic
 * mutate with rollback on failure), a distinct concept — a job can be saved
 * and later hidden independently. Signed out, `ready` is false and the caller
 * should route to the auth modal instead of hiding.
 */
export function useDismissedJobs() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['dismissed'],
    queryFn: dismissedSlugs,
    enabled: !!user,
    staleTime: 30_000,
  });

  const dismissedSet = useMemo(() => new Set(data ?? []), [data]);
  // Stable across renders as long as the set itself hasn't changed, so callers
  // (e.g. the feed's `jobs` useMemo) can safely depend on it.
  const isDismissed = useCallback((slug: string) => dismissedSet.has(slug), [dismissedSet]);

  const mutation = useMutation({
    mutationFn: (slug: string) => dismissJob(slug),
    onMutate: async (slug) => {
      await qc.cancelQueries({ queryKey: ['dismissed'] });
      const previous = qc.getQueryData<string[]>(['dismissed']) ?? [];
      qc.setQueryData<string[]>(['dismissed'], [...previous, slug]);
      return { previous };
    },
    onError: (_err, _slug, ctx) => {
      if (ctx) qc.setQueryData(['dismissed'], ctx.previous); // roll back — restores the card
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['dismissed'] }),
  });

  return {
    ready: !!user,
    isDismissed,
    hide: (slug: string) => mutation.mutate(slug),
  };
}
