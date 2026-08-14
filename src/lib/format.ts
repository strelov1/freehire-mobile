/**
 * Presentation helpers for a job card. Pure functions that turn the API's
 * controlled-vocabulary codes and raw fields into display strings — ported from
 * the web app (hire/web/src/lib/enrichment.ts + utils.ts) so a card reads the
 * same on phone and web. The client never re-validates; it only formats.
 */

import type { Company, Enrichment, Job, LocationPreferences } from './types';

// --- Label maps (only codes whose label differs from the title-cased fallback) --

const REGION_LABELS: Record<string, string> = {
  global: 'Global',
  north_america: 'North America',
  latam: 'LATAM',
  eu: 'Europe',
  uk: 'UK',
  mena: 'MENA',
  africa: 'Africa',
  apac: 'APAC',
  cis: 'CIS',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
};

const WORK_MODE_LABELS: Record<string, string> = { onsite: 'On-site' };
const SENIORITY_LABELS: Record<string, string> = { c_level: 'C-level' };

// Facet label maps ported from hire/web/src/lib/labels.ts + enrichment.ts — only
// the codes whose label differs from the humanized fallback are listed.
const CATEGORY_LABELS: Record<string, string> = {
  ml_ai: 'ML / AI',
  ai_engineering: 'AI Engineer',
  data_engineering: 'Data Engineering',
  data_science: 'Data Science',
  data_analytics: 'Data Analytics',
  qa: 'QA',
  devops: 'DevOps',
  sre: 'SRE',
  project_management: 'Project Management',
};

const DOMAIN_LABELS: Record<string, string> = {
  fintech: 'FinTech',
  ecommerce: 'E-commerce',
  saas: 'SaaS',
  gamedev: 'GameDev',
  edtech: 'EdTech',
  adtech: 'AdTech',
  govtech: 'GovTech',
  healthcare: 'Healthcare',
};

const COMPANY_TYPE_LABELS: Record<string, string> = { inhouse: 'In-house' };

const RELOCATION_LABELS: Record<string, string> = {
  not_supported: 'Not supported',
  supported: 'Supported',
  required: 'Required',
};

const ENGLISH_LABELS: Record<string, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
  c2: 'C2',
  native: 'Native',
};

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
const PERIOD_SUFFIX: Record<string, string> = {
  month: ' / mo',
  day: ' / day',
  hour: ' / hr',
  // `year` is the implicit default and reads cleaner with no suffix.
};

/** Title-case an unknown snake_case code, so a future vocabulary addition never
 *  renders blank (e.g. "data_engineering" → "Data engineering"). */
function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function label(map: Record<string, string>, value: string): string {
  return map[value] ?? humanize(value);
}

// --- Time -------------------------------------------------------------------

const TIME_UNITS: [string, number][] = [
  ['y', 31536000],
  ['mo', 2592000],
  ['w', 604800],
  ['d', 86400],
  ['h', 3600],
  ['m', 60],
];

/**
 * Compact "how long ago" for the card's top-right corner: "3d", "5h", "2w".
 * Deliberately short (unlike the web's "3 days ago") because the corner is tight.
 * Returns "now" for anything under a minute, "" for a missing/invalid timestamp.
 */
export function timeAgo(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'now';
  for (const [unit, span] of TIME_UNITS) {
    if (seconds >= span) return `${Math.round(seconds / span)}${unit}`;
  }
  return 'now';
}

// --- Salary -----------------------------------------------------------------

/** Group thousands with thin spaces, matching the web's salary line. */
function groupThousands(n: number): string {
  return n.toLocaleString('en-US').replace(/,/g, ' ');
}

/**
 * Render the compensation line, or null when no salary is stated. Handles the
 * full range, a min-only floor ("from …"), and a max-only ceiling ("up to …").
 * The currency symbol and period suffix trail the amount, as in the design.
 */
export function formatSalary(e: Enrichment | null | undefined): string | null {
  if (!e) return null;
  const { salary_min, salary_max } = e;
  if (salary_min == null && salary_max == null) return null;

  const symbol = e.salary_currency
    ? CURRENCY_SYMBOL[e.salary_currency] ?? e.salary_currency
    : '';
  const period = e.salary_period ? PERIOD_SUFFIX[e.salary_period] ?? '' : '';
  const tail = `${symbol}${period}`;

  let amount: string;
  if (salary_min != null && salary_max != null) {
    amount = `${groupThousands(salary_min)} – ${groupThousands(salary_max)}`;
  } else if (salary_min != null) {
    amount = `from ${groupThousands(salary_min)}`;
  } else {
    amount = `up to ${groupThousands(salary_max as number)}`;
  }
  return tail ? `${amount} ${tail}` : amount;
}

// --- Chips ------------------------------------------------------------------

/**
 * The quiet outline chips under the title: work mode, region(s), employment
 * type, seniority — in that order of signal, matching the web card. Absent
 * facets are simply skipped, so a sparse job shows fewer chips rather than
 * empty placeholders.
 */
export function cardTags(job: Job): string[] {
  const e = job.enrichment;
  const tags: string[] = [];

  if (e?.work_mode) tags.push(label(WORK_MODE_LABELS, e.work_mode));
  if (job.regions?.length) {
    tags.push(job.regions.map((r) => label(REGION_LABELS, r)).join(', '));
  }
  if (e?.employment_type) tags.push(label(EMPLOYMENT_LABELS, e.employment_type));
  if (e?.seniority) tags.push(label(SENIORITY_LABELS, e.seniority));

  return tags;
}

// --- Blurb ------------------------------------------------------------------

/**
 * A one-line description for the card. Prefer the clean model-written summary,
 * but only tech jobs are enriched — fall back to a plain-text snippet of the raw
 * HTML posting so non-tech jobs still show something. Strips tags and collapses
 * whitespace, then truncates on a word boundary.
 */
export function blurb(job: Job, max = 160): string | null {
  const summary = job.enrichment?.summary?.trim();
  if (summary) return summary;

  const raw = job.description ?? '';
  if (!raw) return null;
  const text = raw
    .replace(/<[^>]*>/g, ' ') // drop tags
    .replace(/&[a-z]+;|&#\d+;/gi, ' ') // drop entities
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

// --- Detail: long date + facet list -----------------------------------------

/**
 * The detail screen's "Posted …" line: the full local date ("Jul 20, 2026"),
 * not the card's compact "3d". Mirrors the web's formatDate. "" for a
 * missing/invalid timestamp so the caller can skip the line entirely.
 */
export function formatDate(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// --- Facet value labels (for the filter screen) -----------------------------

/** The label map for each filterable facet param — reuses the same vocabularies
 *  the detail view already maps. `countries` is handled specially (ISO2 → upper). */
const FACET_LABEL_MAPS: Record<string, Record<string, string>> = {
  work_mode: WORK_MODE_LABELS,
  employment_type: EMPLOYMENT_LABELS,
  seniority: SENIORITY_LABELS,
  regions: REGION_LABELS,
  category: CATEGORY_LABELS,
};

/** Display label for a facet value code, e.g. facetValueLabel('seniority',
 *  'c_level') → 'C-level'. Unknown params/codes fall back to a humanized form. */
export function facetValueLabel(param: string, value: string): string {
  if (param === 'countries') return value.toUpperCase();
  const map = FACET_LABEL_MAPS[param];
  return map ? label(map, value) : humanize(value);
}


/** A metadata row in the detail sidebar: one label with one or more values. */
export type Facet = { label: string; values: string[] };

/**
 * The detail screen's facet list — a port of the web's summaryFacets, minus the
 * filter links (the mobile app has no filter screen yet, so values are plain
 * text). Same order and label vocabulary as the web so a job reads identically.
 * Absent facets are skipped, so a sparse job shows a shorter list rather than
 * empty rows.
 */
export function summaryFacets(job: Job): Facet[] {
  const e = job.enrichment ?? {};
  const facets: Facet[] = [];

  const one = (name: string, text: string | null | undefined) => {
    if (text) facets.push({ label: name, values: [text] });
  };
  const many = (name: string, values: string[] | undefined) => {
    if (values?.length) facets.push({ label: name, values });
  };

  one('Work format', job.work_mode ? label(WORK_MODE_LABELS, job.work_mode) : null);
  one('Location', job.location);
  many('Region', job.regions?.map((r) => label(REGION_LABELS, r)));
  one('Work type', e.employment_type ? label(EMPLOYMENT_LABELS, e.employment_type) : null);
  one('Grade', e.seniority ? label(SENIORITY_LABELS, e.seniority) : null);
  one('Experience', e.experience_years_min != null ? `${e.experience_years_min}+ yrs` : null);
  // english_level carries a 'none' sentinel that must not render as a facet.
  const english = e.english_level && e.english_level !== 'none' ? e.english_level : null;
  one('English', english ? label(ENGLISH_LABELS, english) : null);
  one('Category', e.category ? label(CATEGORY_LABELS, e.category) : null);
  many('Country', job.countries?.map((c) => c.toUpperCase()));
  one('Relocation', e.relocation ? label(RELOCATION_LABELS, e.relocation) : null);
  if (e.visa_sponsorship === true) facets.push({ label: 'Visa', values: ['Sponsored'] });
  one('Company', e.company_type ? label(COMPANY_TYPE_LABELS, e.company_type) : null);
  one('Size', e.company_size);
  many('Domains', e.domains?.map((d) => label(DOMAIN_LABELS, d)));

  return facets;
}

/**
 * The company screen's facts list: same `label` + `values` shape as
 * `summaryFacets`, so the screen can reuse its facet-row rendering. Absent
 * fields are skipped, same convention as `summaryFacets`.
 */
export function companyFacts(company: Company): Facet[] {
  const info = company.company_info ?? {};
  const facts: Facet[] = [];

  const one = (name: string, text: string | null | undefined) => {
    if (text) facts.push({ label: name, values: [text] });
  };

  if (company.industries?.length) facts.push({ label: 'Industries', values: company.industries });
  one('Founded', company.year_founded ? String(company.year_founded) : null);
  one('Employees', company.employee_count ? String(company.employee_count) : null);
  one('HQ', company.hq_country);
  one('Type', company.organization_type);
  one('Stage', info.stage);
  if (info.funding?.type || info.funding?.amount) {
    const amount = info.funding.amount ? `$${info.funding.amount.toLocaleString('en-US')}` : null;
    facts.push({ label: 'Funding', values: [info.funding.type, amount].filter((v): v is string => !!v) });
  }
  if (info.stock?.symbol) {
    facts.push({
      label: 'Stock',
      values: [info.stock.symbol, info.stock.exchange].filter((v): v is string => !!v),
    });
  }

  return facts;
}

/** The company screen's rating line, e.g. "4.5 (12 reviews)" — the screen
 *  pairs this with a star icon rather than a text glyph. Null when there's no
 *  feedback yet (feedback_rating_avg is null while feedback_count is 0, per
 *  the server). */
export function companyRating(company: Company): string | null {
  if (company.feedback_count === 0 || company.feedback_rating_avg == null) return null;
  const reviews = company.feedback_count === 1 ? 'review' : 'reviews';
  return `${company.feedback_rating_avg.toFixed(1)} (${company.feedback_count} ${reviews})`;
}

// --- Profile location summary (for the Profile screen) ----------------------

/** Region/country codes rendered as one comma-joined list: regions through the
 *  regions label map, countries uppercased — the same convention `summaryFacets`
 *  and the Filters screen use for each individually. */
function geoList(regions: string[] | undefined, countries: string[] | undefined): string | null {
  const parts = [
    ...(regions ?? []).map((r) => label(REGION_LABELS, r)),
    ...(countries ?? []).map((c) => c.toUpperCase()),
  ];
  return parts.length ? parts.join(', ') : null;
}

/**
 * The Profile screen's read-only location summary: up to four lines (work
 * modes, remote reach, base, relocation targets), each present only when the
 * saved profile has data for it. `null` (no saved `location_preferences`)
 * yields no lines. Relocation is included only when `relocation.open` is
 * true — an unopened relocation block's regions/countries are a stale draft,
 * not a stated preference (same gate `filtersFromProfile` in `jobFilters.ts`
 * applies when seeding filters from a profile).
 */
export function profileLocationSummary(loc: LocationPreferences | null): string[] {
  if (!loc) return [];
  const lines: string[] = [];

  if (loc.work_modes?.length) {
    lines.push(`Open to: ${loc.work_modes.map((m) => label(WORK_MODE_LABELS, m)).join(', ')}`);
  }

  const remote = geoList(loc.remote?.regions, loc.remote?.countries);
  if (remote) lines.push(`Remote: ${remote}`);

  const base = loc.base;
  if (base?.city && base.country) {
    lines.push(`Based in: ${base.city}, ${base.country.toUpperCase()}`);
  } else if (base?.city) {
    lines.push(`Based in: ${base.city}`);
  } else if (base?.country) {
    lines.push(`Based in: ${base.country.toUpperCase()}`);
  }

  if (loc.relocation.open) {
    const reloc = geoList(loc.relocation.regions, loc.relocation.countries);
    if (reloc) lines.push(`Open to relocation: ${reloc}`);
  }

  return lines;
}
