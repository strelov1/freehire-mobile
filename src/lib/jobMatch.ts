/**
 * Everything the profile match decides without React or a network, ported from
 * the web's `hire/web/src/lib/jobMatch.ts`:
 *
 * - `computeClientMatch`, the feed card's exact-only overlap, computed on the
 *   device with no request. No adjacency — that dictionary is the server's.
 * - `resolveMatchState`, which of the detail block's five states applies, and
 *   therefore whether the endpoint may be called at all.
 * - `matchHasGroups`, the one reading the screen hides its own skill row on.
 * - `matchBarSegments`, the two-segment bar's geometry.
 * - `partitionBlockers` / `blockerTone`, the advisory hard-constraint list.
 */

import type { Blocker } from './types';

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

/**
 * Split the hard-constraint blockers for display: the unmet ones first — hardest
 * first, a lower `score_cap` being a harder blocker — then the met ones, shown
 * as satisfied.
 *
 * They are advisory. Nothing derived from them may hide, filter or downrank the
 * job, and none of them moves the coverage figure: the server computes coverage
 * from skills alone, and an unmet work permit is not a skill the candidate is
 * missing.
 */
export function partitionBlockers(blockers: Blocker[] | null | undefined): {
  unmet: Blocker[];
  met: Blocker[];
} {
  const all = blockers ?? [];
  return {
    unmet: all.filter((b) => !b.met).sort((a, b) => a.score_cap - b.score_cap),
    met: all.filter((b) => b.met),
  };
}

/** Which palette tone an unmet constraint reads in. A hard constraint — work
 *  authorization, a required certification — is blocking; a fit constraint like
 *  location or language is a caution; anything else is a quiet note. The web
 *  returns a Tailwind class here; this app's colours are palette lookups, so
 *  this returns the token name to read off `getColors`. */
export type BlockerTone = 'destructive' | 'warningStrong' | 'mutedForeground';

export function blockerTone(severity: string): BlockerTone {
  if (severity === 'hard') return 'destructive';
  if (severity === 'medium') return 'warningStrong';
  return 'mutedForeground';
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
