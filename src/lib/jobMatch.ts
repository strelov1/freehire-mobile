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

/** The locked-state teaser: plausible figures for a match nobody has computed,
 *  shown blurred to a viewer who cannot have one yet as an invitation rather
 *  than an estimate. `{total, matched, percent}` is the `ClientMatch` shape, so
 *  the same bar renders it; `missing` names which of the job's own skills read
 *  as not-held, leaving each surface free to show as many chips as it has room
 *  for. */
export type MatchTeaser = ClientMatch & { missing: Set<string> };

/** FNV-1a (32-bit). Seeds the teaser from the job's slug so the same job yields
 *  the same figures on every render. `Math.random()` would re-roll them each
 *  time a FlatList remounted a card — the score changing under the user's thumb
 *  as they scrolled is the one way a fabricated figure gets caught. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — a small seeded PRNG, enough to shuffle a handful of skill names. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEASER_MIN = 60;
const TEASER_MAX = 90;

/**
 * Derive the teaser for one job. Null when the job has fewer than two skills:
 * there is no have/missing story to tell about a single one, and "1 of 1 skills"
 * beside an 87% bar is the one figure a viewer could disprove at a glance.
 *
 * `matched` FOLLOWS from `percent` rather than being rolled beside it, so the
 * "N of M skills" label can never contradict the bar. What the seed randomises
 * is WHICH skills read as missing, so the missing chips scatter through the row.
 *
 * The band's top is capped per skill count: at five skills, 90% would round to
 * 5 of 5 and leave an all-held row under a bar that isn't full. Keeping the
 * percent below `100 − 50/total` guarantees one missing skill, so both tones
 * always show.
 *
 * Ported from the web's `jobMatch.ts`, seed for seed: the same job must read the
 * same in the app as on the site.
 */
export function matchTeaser(seed: string, jobSkills: string[]): MatchTeaser | null {
  const total = jobSkills.length;
  if (total < 2) return null;

  const h = hashSeed(seed);
  // The largest whole percent that still rounds below `total` — Math.ceil(x) - 1
  // is the greatest integer strictly less than x, for a fractional x and an
  // exact one alike.
  const ceiling = Math.min(TEASER_MAX, Math.ceil(100 - 50 / total) - 1);
  const percent = TEASER_MIN + (h % (ceiling - TEASER_MIN + 1));
  const matched = Math.round((percent / 100) * total);

  // Give every skill a seeded sort key and take the lowest `total - matched` as
  // the missing ones — a shuffle without the index juggling.
  const rand = mulberry32(h);
  const missing = new Set(
    jobSkills
      .map((name) => ({ name, key: rand() }))
      .sort((a, b) => a.key - b.key)
      .slice(0, total - matched)
      .map((s) => s.name),
  );

  return { total, matched, percent, missing };
}

/** Which skills a narrow teaser row should show. Takes the job's leading skills,
 *  but if that window happens to be all-held it trades its last chip for the
 *  first missing skill further down — a three-chip row cut from a job with one
 *  missing skill would otherwise come out uniformly held, losing the contrast
 *  that is the teaser's whole point. The job's own order is preserved among the
 *  chips that stay. */
export function teaserChips(jobSkills: string[], missing: Set<string>, limit: number): string[] {
  const shown = jobSkills.slice(0, limit);
  // A one-chip row has nothing to spare: trading its only chip would leave it
  // all-missing, which inverts the contrast rather than showing it.
  if (shown.length > 1 && shown.length < jobSkills.length && !shown.some((s) => missing.has(s))) {
    const borrowed = jobSkills.find((s) => missing.has(s));
    if (borrowed) return [...shown.slice(0, -1), borrowed];
  }
  return shown;
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
