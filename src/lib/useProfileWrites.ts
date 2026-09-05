import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { saveProfile } from './api';
import { useAuth } from './authStore';
import { privateKeys } from './queryKeys';
import { createSerialQueue } from './serialQueue';
import type { UserProfile } from './types';

/**
 * The one-skill-at-a-time profile writes the match block's chips produce.
 *
 * Serialised, because the endpoint replaces the whole row: two claims a second
 * apart would otherwise be built from the same snapshot, and the first would be
 * dropped by the second with no error anywhere. See `createSerialQueue`.
 *
 * `invalidateMatches` is the caller's call rather than this hook's, and the two
 * answers are not symmetric. A claim changes what the viewer holds, so every
 * cached match is now wrong and has to be refetched. An avoid changes nothing
 * the match is computed from — the server scores held skills alone, and an
 * avoided skill is still one the candidate does not have — so refetching would
 * spend a request to be told exactly what is already on screen.
 */
export function useProfileWrites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queue = useRef(createSerialQueue<UserProfile>());

  return useCallback(
    (build: (current: UserProfile) => UserProfile, options: { invalidateMatches: boolean }) =>
      queue.current.enqueue(
        () => queryClient.getQueryData<UserProfile | null>(['profile']) ?? null,
        async (current) => {
          const saved = await saveProfile(build(current));
          queryClient.setQueryData(['profile'], saved);
          if (options.invalidateMatches && user) {
            await queryClient.invalidateQueries({ queryKey: privateKeys.jobMatches(user.id) });
          }
          return saved;
        },
      ),
    [queryClient, user],
  );
}
