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
