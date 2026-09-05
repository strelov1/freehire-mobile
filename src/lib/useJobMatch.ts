import { useQuery } from '@tanstack/react-query';

import { getJobMatch } from './api';
import { useAuth } from './authStore';
import { resolveMatchState, type MatchState } from './jobMatch';
import { useProfile } from './useProfile';
import { privateKeys } from './queryKeys';

/**
 * The server-computed profile match for one job, plus the state the block should
 * render.
 *
 * The state is what gates the request. `enabled: state === 'ready'` is the whole
 * of the spec's "the guest and no-profile states MUST NOT call the match
 * endpoint" — a rule the wiring enforces rather than one every future caller has
 * to remember.
 *
 * `jobSkills` must be the job's own `skills` (the served dictionary facet), never
 * the detail screen's `skills || enrichment.skills` fallback: the server matches
 * on the facet alone, so an enrichment-only job would spend a request to be told
 * `total: 0`.
 *
 * The key carries the user id, so `clearPrivateUserData` drops the match when who
 * is signed in changes; it carries the slug, so react-query swaps cache entries
 * on navigation and cancels the outgoing request itself.
 */
export function useJobMatch(slug: string | undefined, jobSkills: string[]) {
  const { user } = useAuth();
  const { data: profile, isPending: profilePending } = useProfile();

  const state: MatchState = resolveMatchState({
    jobSkills,
    authenticated: !!user,
    // `useProfile` is disabled while signed out, and a disabled query stays
    // pending forever — so a signed-out viewer would sit in `loading` if this
    // were read on its own. The auth gate above resolves first, which is the
    // only reason reading it plainly here is safe.
    profileLoaded: !profilePending,
    profileSkills: profile?.skills,
  });

  const query = useQuery({
    // A locked viewer gets the no-user key rather than a stand-in id: it is never
    // populated, and a fake id in a namespace meaning "this belongs to user N" is
    // the kind of placeholder that later reads as real.
    queryKey:
      user && slug ? privateKeys.jobMatch(user.id, slug) : privateKeys.signedOutJobMatch(slug ?? ''),
    queryFn: ({ signal }) => getJobMatch(slug as string, signal),
    enabled: !!slug && state === 'ready',
  });

  return { state, ...query };
}
