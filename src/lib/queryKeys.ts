import type { Query, QueryClient } from '@tanstack/react-query';

export const publicKeys = {
  jobs: {
    search: (query: string) => ['public', 'jobs', 'search', query] as const,
    detail: (slug: string | undefined) => ['public', 'jobs', 'detail', slug] as const,
  },
  companies: {
    /** Keyed on the SETTLED search text, so changing it swaps cache entries and
     *  pagination restarts from the first page. */
    search: (query: string) => ['public', 'companies', 'search', query] as const,
  },
  facets: (query: string) => ['public', 'facets', query] as const,
  oauthProviders: ['public', 'auth', 'oauth-providers'] as const,
  v2Providers: ['public', 'auth', 'v2-providers'] as const,
  providers: ['public', 'auth', 'v2-providers'] as const,
};

export const privateKeys = {
  root: (userId: number) => ['private', userId] as const,
  savedJobs: (userId: number) => ['private', userId, 'saved-jobs'] as const,
  signedOutSavedJobs: ['private', 'none', 'saved-jobs'] as const,
  identities: (userId: number) => ['private', userId, 'identities'] as const,
  tracker: (userId: number) => ['private', userId, 'tracker'] as const,
  trackerList: (userId: number, filter: string = 'board') =>
    ['private', userId, 'tracker', 'list', filter] as const,
  trackerPipeline: (userId: number) => ['private', userId, 'tracker', 'pipeline'] as const,
  /** The plan, which is per-account and must not survive a change of who is signed in —
   *  showing the previous user's Pro to the next one would be both wrong and a way to sell
   *  them a plan they already have. */
  plan: (userId: number) => ['private', userId, 'plan'] as const,
  /** The key a signed-out reader uses. Never populated — there is no plan without an
   *  account — and it exists so that state is not spelled as a user id nobody has. */
  signedOutPlan: ['private', 'none', 'plan'] as const,
  /** One job's profile match. Private for the same reason the plan is: it is a
   *  statement about one person's skills, and the next person to sign in on this
   *  device must not be shown the last one's coverage. Keyed on the slug too, so
   *  navigating between jobs swaps cache entries instead of racing. */
  jobMatch: (userId: number, slug: string) => ['private', userId, 'job-match', slug] as const,
  /** Every cached match for one user. Editing a profile's skills moves all of
   *  them at once, so the invalidation is a prefix rather than a slug. */
  jobMatches: (userId: number) => ['private', userId, 'job-match'] as const,
  /** The key a locked viewer uses — signed out, or signed in without profile
   *  skills. Never populated: those states have nothing to match against. */
  signedOutJobMatch: (slug: string) => ['private', 'none', 'job-match', slug] as const,
};

export function isPrivateQueryForUser(userId: number) {
  return (query: Query) => query.queryKey[0] === 'private' && query.queryKey[1] === userId;
}

type Registration = { userId: number; sessionEpoch: number; controller: AbortController };

/** TanStack Query can cancel queries; private mutations need their own transport registry. */
export class PrivateMutationRegistry {
  private registrations = new Set<Registration>();

  create(userId: number, sessionEpoch: number) {
    const registration: Registration = { userId, sessionEpoch, controller: new AbortController() };
    this.registrations.add(registration);
    return {
      signal: registration.controller.signal,
      release: () => this.registrations.delete(registration),
    };
  }

  abortUser(userId: number) {
    for (const registration of this.registrations) {
      if (registration.userId === userId) {
        registration.controller.abort();
        this.registrations.delete(registration);
      }
    }
  }
}

export async function clearPrivateUserData(
  queryClient: QueryClient,
  mutationRegistry: PrivateMutationRegistry,
  userId: number,
) {
  mutationRegistry.abortUser(userId);
  const predicate = isPrivateQueryForUser(userId);
  await queryClient.cancelQueries({ predicate });
  queryClient.removeQueries({ predicate });
  // Also purge top-level user data caches so no stale user data persists across identity switches
  await queryClient.cancelQueries({ queryKey: ['profile'] });
  queryClient.removeQueries({ queryKey: ['profile'] });
  await queryClient.cancelQueries({ queryKey: ['dismissed'] });
  queryClient.removeQueries({ queryKey: ['dismissed'] });
  await queryClient.cancelQueries({ queryKey: ['notifications'] });
  queryClient.removeQueries({ queryKey: ['notifications'] });
  await queryClient.cancelQueries({ queryKey: ['push'] });
  queryClient.removeQueries({ queryKey: ['push'] });
}
