import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from './authStore';
import { privateKeys } from './queryKeys';
import { getPlan } from '@/features/billing/api/planApi';

/**
 * The signed-in user's plan, from the server.
 *
 * This is the ONLY thing that decides whether the app believes somebody is Pro. The purchases
 * SDK has an answer locally and instantly and it is not used for this: the web and the app
 * share one plan and only the server sees both, the API answers 402 from the server's view,
 * and a refund the store processed an hour ago is already in the server's column while a
 * cached CustomerInfo may not know about it yet.
 *
 * `enabled: !!user` keeps it from ever firing for a signed-out visitor — the endpoint would
 * just throw ApiError(401) — and the key sits under `privateKeys` so `clearPrivateUserData`
 * drops it the moment the session changes.
 *
 * A short `staleTime` on purpose: the plan changes rarely, but when it changes it is because
 * money moved, and the screen that shows it is opened precisely at those moments.
 */
export function usePlan() {
  const { user } = useAuth();

  return useQuery({
    // A signed-out reader gets the signed-out key rather than a stand-in id. It is never
    // populated — `enabled` sees to that — but a fake id in a namespace that means "this
    // belongs to user N" is the kind of placeholder that later reads as real.
    queryKey: user ? privateKeys.plan(user.id) : privateKeys.signedOutPlan,
    queryFn: ({ signal }) => getPlan(signal),
    enabled: !!user,
    staleTime: 30_000,
  });
}

/**
 * Drops the cached plan so the next read comes from the server.
 *
 * Used after a purchase or a restore, where the whole point is that the previous answer is
 * known to be out of date.
 */
export function useRefreshPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    if (!user) return;
    await queryClient.invalidateQueries({ queryKey: privateKeys.plan(user.id) });
  }, [queryClient, user]);
}
