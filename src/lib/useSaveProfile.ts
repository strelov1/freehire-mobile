import { useMutation, useQueryClient } from '@tanstack/react-query';

import { saveProfile } from './api';
import { useAuth } from './authStore';
import { privateKeys } from './queryKeys';
import type { UserProfile } from './types';

/**
 * Saves the signed-in user's profile.
 *
 * Two cache effects, and the second is the one worth stating. The response is
 * the saved profile in the same shape the read serves — the server normalises
 * what it stores and answers with the result — so `['profile']` is seeded from
 * it rather than refetched.
 *
 * And every cached per-job match is invalidated, not just the profile: a match
 * is a statement about the skills that were just edited, so the coverage on the
 * job screen behind this one is wrong the moment the save lands.
 */
export function useSaveProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profile: UserProfile) => saveProfile(profile),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['profile'], saved);
      if (user) {
        await queryClient.invalidateQueries({ queryKey: privateKeys.jobMatches(user.id) });
      }
    },
  });
}
