/**
 * The job-reality trust signal, ported from hire/web/src/lib/reality.ts. Pure
 * functions that turn the served `Reality` facts into a badge and a contrast
 * note — the client states facts, never a bare accusation, and re-validates
 * nothing. `realityBadge` returns null for a fresh/unclassified job (show
 * nothing at all).
 */

import { timeAgo } from './format';
import type { Reality } from './types';

export type RealityBadgeData = {
  tone: 'warn' | 'muted';
  label: string; // the compact chip text ("Open 21d" / "Likely evergreen")
  evidence: string; // complementary facts, minus the age the label already carries
};

/** The observable evidence behind a non-fresh classification, EXCLUDING the age
 *  (the chip label already carries it, so restating it would read twice). */
function evidenceParts(r: Reality): string[] {
  const parts: string[] = [];
  if (r.repost_count > 1) parts.push(`reposted ${r.repost_count}×`);
  if (r.mass_posting_count > 1) parts.push(`${r.mass_posting_count} open copies`);
  if (r.fake_freshness) parts.push('posting date refreshed');
  return parts;
}

/** Map the served reality signal to a badge, or null when there is nothing to
 *  show (a fresh or missing signal). */
export function realityBadge(reality?: Reality | null): RealityBadgeData | null {
  if (!reality || reality.class === 'fresh') return null;
  const evidence = evidenceParts(reality).join(' · ');
  if (reality.class === 'likely-evergreen') {
    return { tone: 'warn', label: 'Likely evergreen', evidence };
  }
  // stale (and any other non-fresh class): a muted age chip.
  return { tone: 'muted', label: `Open ${reality.age_days}d`, evidence };
}

/**
 * A "posting dated N ago" note when the source's posting date reads meaningfully
 * fresher than the job's true age — the refreshed-date story the age label alone
 * hides. "" when there's no/unparseable posting date or the gap is too small.
 */
export function postingContrast(reality: Reality, postedAt?: string | null): string {
  if (!postedAt) return '';
  const d = new Date(postedAt);
  if (Number.isNaN(d.getTime())) return '';
  const postedDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  // The badge only shows for non-fresh jobs (age > 14d); a posting reading a
  // clear week fresher than that true age is the contrast worth surfacing.
  if (reality.age_days - postedDays < 7) return '';
  const ago = timeAgo(postedAt);
  return ago ? `posting dated ${ago}` : '';
}

// --- Freshness badges -------------------------------------------------------

/** Within this many days a posting still reads as new. */
const NEW_DAYS = 7;
/** …and within this many, with few enough applies, as worth being early to. */
const EARLY_DAYS = 3;
const EARLY_APPLIES = 3;

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/**
 * The card's freshness badges: "New", and an invitation to be an early
 * applicant. Ported from the web's `cardFreshnessBadges`, thresholds included.
 *
 * The gate is deliberately strict, and in three ways.
 *
 * A card with NO reality signal claims nothing. Without it there is no way to
 * tell a genuinely fresh posting from one whose source rewrites its date on
 * every crawl — and a card is the surface people scan fastest and least
 * critically. An absent badge costs less than a false one.
 *
 * A posting the signal has classified as anything but fresh, or whose date it
 * distrusts (`fake_freshness`), gets nothing either: those are precisely the
 * dates that would otherwise print "New" on the oldest job in the catalogue.
 *
 * And a closed posting is never worth hurrying to, whatever its date says.
 *
 * `appliedCount` counts the signed-in users who marked this job applied HERE. It
 * cannot see the employer's inbox, so being early is offered as an invitation
 * rather than stated as a fact.
 */
export function freshnessBadges(
  postedAt?: string | null,
  reality?: Reality | null,
  appliedCount = 0,
  closedAt?: string | null,
): string[] {
  if (closedAt) return [];
  if (!reality) return [];
  if (reality.class !== 'fresh' || reality.fake_freshness) return [];

  const days = daysSince(postedAt);
  if (days === null || days > NEW_DAYS) return [];

  const badges = ['New'];
  if (days <= EARLY_DAYS && appliedCount <= EARLY_APPLIES) badges.push('Be an early applicant');
  return badges;
}
