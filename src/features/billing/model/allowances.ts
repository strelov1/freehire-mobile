import type { Plan } from '../api/planApi';

/**
 * The per-feature daily allowances, as the plan screen lists them.
 *
 * A note on why this is here at all: none of these features is reachable from this app. They
 * are freehire's AI surfaces — the assistant, CV tailoring, match analysis — and today they
 * live on the web. The screen shows them because the plan is one plan across both, and a
 * subscriber deciding whether Pro is worth it should see what it lifts. The screen says where
 * they are spent, so the list does not read as a promise about buttons this app does not have.
 */

/** One feature's standing today. */
export type AllowanceRow = {
  /** The server's own feature name, and the list key. */
  key: string;
  label: string;
  /** What is left of today, in words the screen prints as given. */
  detail: string;
};

/**
 * Labels for the features that exist today. The map is not exhaustive on purpose — the server
 * owns this list and will add to it, and an unfamiliar feature is shown by its own name rather
 * than hidden, so a new one appears without a release.
 */
const LABELS: Record<string, string> = {
  match: 'Job match analysis',
  tailor: 'CV tailoring',
  assistant: 'Assistant',
  chat: 'Chat',
  dictation: 'Voice dictation',
};

/** Known features first, in the order somebody meets them; the rest keep the server's order. */
const ORDER = ['match', 'tailor', 'assistant', 'chat', 'dictation'];

export function allowanceRows(plan: Plan | undefined): AllowanceRow[] {
  const allowances = plan?.allowances;
  if (!Array.isArray(allowances)) return [];

  return allowances
    .flatMap((raw) => {
      const row = readAllowance(raw);
      return row ? [row] : [];
    })
    .sort((a, b) => rank(a.key) - rank(b.key));
}

function rank(feature: string): number {
  const known = ORDER.indexOf(feature);
  return known === -1 ? ORDER.length : known;
}

function readAllowance(raw: unknown): AllowanceRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<NonNullable<Plan['allowances']>[number]>;

  const key = typeof a.feature === 'string' ? a.feature : '';
  if (!key) return null;

  return { key, label: LABELS[key] ?? humanise(key), detail: detailFor(a) };
}

/**
 * What today looks like for one feature.
 *
 * `enforced` decides whether a ceiling may be spoken of as one. While it is false the server
 * counts the allowance and still runs the action, so printing "4 of 3" would promise a refusal
 * that does not happen — and printing "0 left" would be worse.
 */
function detailFor(a: Partial<NonNullable<Plan['allowances']>[number]>): string {
  if (a.unlimited) return 'Unlimited';

  const used = typeof a.used === 'number' ? a.used : 0;
  if (!a.enforced || typeof a.limit !== 'number' || a.limit <= 0) return `${used} used today`;

  return `${used} of ${a.limit} today`;
}

/** `brand_new_thing` → `Brand new thing`. Enough to be readable, and honest about being raw. */
function humanise(feature: string): string {
  const words = feature.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : feature;
}
