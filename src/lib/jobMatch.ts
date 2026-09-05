/**
 * Client-side profile skill match, ported from the web's
 * `hire/web/src/lib/jobMatch.ts::computeClientMatch`. Exact case-insensitive
 * overlap only — no adjacency/fuzzy matching, which is a separate,
 * server-side signal the mobile card doesn't show.
 */

export type ClientMatch = { total: number; matched: number; percent: number };

/** How many of a job's skills the user's profile already has (case-insensitive
 *  set intersection) and the coverage percent. `total` is the job's skill
 *  count; a job with no skills is a zero match (no divide-by-zero). */
export function computeClientMatch(jobSkills: string[], profileSkills: string[]): ClientMatch {
  const have = new Set(profileSkills.map((s) => s.toLowerCase()));
  const total = jobSkills.length;
  const matched = jobSkills.filter((s) => have.has(s.toLowerCase())).length;
  const percent = total === 0 ? 0 : Math.round((matched / total) * 100);
  return { total, matched, percent };
}

/** Which state the detail screen's match block renders. `loading` is the window
 *  while a signed-in viewer's profile is still in flight — held apart from
 *  `no-profile` so the block doesn't flash a call-to-action it's about to drop. */
export type MatchState = 'no-skills' | 'guest' | 'loading' | 'no-profile' | 'ready';

/**
 * Resolve the block's state from what the screen already knows, in the web's
 * precedence: `no-skills` beats everything (there is nothing personal to say
 * about a job carrying none), then the auth gate, then the profile gate.
 *
 * `jobSkills` MUST be the job's own `skills` — the served dictionary facet — and
 * not the detail screen's `skills || enrichment.skills` fallback. The server
 * matches on the facet alone, so an enrichment-only job resolved through the
 * fallback would spend a request only to be told `total: 0`.
 *
 * Only `ready` may call the match endpoint, and `useJobMatch` enforces that by
 * passing this through to react-query's `enabled` rather than trusting callers.
 */
export function resolveMatchState(input: {
  jobSkills: string[];
  authenticated: boolean;
  profileLoaded: boolean;
  profileSkills: string[] | null | undefined;
}): MatchState {
  if (input.jobSkills.length === 0) return 'no-skills';
  if (!input.authenticated) return 'guest';
  if (!input.profileLoaded) return 'loading';
  if (!input.profileSkills || input.profileSkills.length === 0) return 'no-profile';
  return 'ready';
}

/**
 * Whether the block is actually rendering its three skill groups — which is what
 * the detail screen keys its own flat skill row off.
 *
 * Deliberately not "the state is `ready`": `ready` means a request was allowed,
 * not that it came back. A failed request, or one answering `total: 0`, leaves
 * the block with nothing to group, and hiding the row on `ready` alone would
 * take the job's skills off the screen in exchange for nothing.
 */
export function matchHasGroups(
  state: MatchState,
  match: { total: number } | null | undefined,
): boolean {
  return state === 'ready' && !!match && match.total > 0;
}

/** The two coverage-bar segment widths, as percentages of the track: a
 *  full-weight segment for exact matches and a half-weight one for adjacent
 *  matches, mirroring the server's own weighting. Their sum is the unrounded
 *  `coverage_percent`, so the drawn fill cannot disagree with the printed
 *  figure. A job with no skills draws nothing rather than dividing by zero. */
export function matchBarSegments(m: {
  total: number;
  exact_count: number;
  adjacent_count: number;
}): { exact: number; adjacent: number } {
  if (m.total <= 0) return { exact: 0, adjacent: 0 };
  return {
    exact: (m.exact_count / m.total) * 100,
    adjacent: ((0.5 * m.adjacent_count) / m.total) * 100,
  };
}
