/**
 * The feed's filter model — a framework-free port of the web app's facetModel.
 * It owns the filter SHAPE and how it serializes to the API's query string; it
 * knows nothing about React, navigation, or the network. The feed and the
 * Filters screen both build on it, and `filtersToQuery` output is fed verbatim
 * to `/api/v1/jobs/search` and `/api/v1/jobs/facets` (each appends its own
 * constants — `semantic_ratio`/`limit`/`offset`, or `disjunctive`).
 *
 * v1 is include-only: a facet holds a flat list of selected value codes (no
 * AND-OR modes the web supports), except `skills`, which also supports exclude
 * — see `JobFilters.skillsExclude`. Serialization repeats the param once per
 * value (`work_mode=remote&work_mode=hybrid`), which the API reads as OR.
 */

import type { UserProfile } from './types';

export type JobFilters = {
  q: string;
  facets: Record<string, string[]>; // param -> selected value codes
  // Skills is the one facet with exclude support (a profile can name skills to
  // avoid; see filtersFromProfile). Every other facet stays include-only in
  // `facets` above — this field exists so that exception stays physically
  // local instead of generalizing the shape every other facet has to carry.
  skillsExclude: string[];
  postedWithinDays: number | null; // maps to posted_within_days; null = Any
};

export const emptyFilters: JobFilters = { q: '', facets: {}, skillsExclude: [], postedWithinDays: null };

/** A filterable facet group with a fixed vocabulary (countries are dynamic and
 *  handled separately — see the Filters screen). Order here is also the order
 *  facets appear in the serialized query and on screen. */
export type FacetDef = { param: string; label: string; values: string[] };

export const FACETS: FacetDef[] = [
  { param: 'work_mode', label: 'Work format', values: ['remote', 'hybrid', 'onsite'] },
  {
    param: 'employment_type',
    label: 'Employment',
    values: ['full_time', 'part_time', 'contract', 'internship'],
  },
  {
    param: 'seniority',
    label: 'Seniority',
    values: ['intern', 'junior', 'middle', 'senior', 'lead', 'staff', 'principal', 'c_level'],
  },
  {
    param: 'regions',
    label: 'Region',
    values: ['global', 'north_america', 'latam', 'eu', 'uk', 'mena', 'africa', 'apac', 'cis'],
  },
  {
    param: 'category',
    label: 'Category',
    values: [
      'backend', 'frontend', 'fullstack', 'mobile', 'devops', 'sre', 'network_engineering',
      'data_engineering', 'data_science', 'data_analytics', 'ml_ai', 'ai_engineering', 'qa',
      'security', 'hardware', 'embedded', 'blockchain', 'architecture', 'design', 'product',
      'project_management', 'management', 'marketing', 'sales', 'support', 'other',
    ],
  },
];

/** The facet params shown on the feed's `/filters/quick` shortcut screen
 *  (reached via the search bar's region button) instead of the main Filters
 *  screen. Single source of truth so the two screens' facet lists can't
 *  silently drift apart. */
export const QUICK_FACET_PARAMS = ['work_mode', 'regions', 'employment_type'];

/** The presets behind the posted-within control (single choice; Any = null). */
export const POSTED_WITHIN: { days: number | null; label: string }[] = [
  { days: 1, label: 'Today' },
  { days: 3, label: '3 days' },
  { days: 7, label: 'Week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: 'Month' },
  { days: 90, label: '3 months' },
  { days: null, label: 'Any' },
];

/** Facet params in serialization order. `countries` has no static vocabulary
 *  (its options come from the live facet distribution) but still serializes. */
const FACET_PARAMS = [
  'work_mode',
  'employment_type',
  'seniority',
  'regions',
  'countries',
  'category',
  'skills',
];

/**
 * Serialize the filter state to a query string: `q` first, then each facet's
 * values (repeated), then `skills_exclude`, then `posted_within_days`.
 * Absent/empty parts are skipped, so the empty filter set is the empty
 * string. Deterministic order keeps it stable as a React Query cache key.
 */
export function filtersToQuery(f: JobFilters): string {
  const p = new URLSearchParams();
  const q = f.q.trim();
  if (q) p.append('q', q);
  for (const param of FACET_PARAMS) {
    for (const value of f.facets[param] ?? []) p.append(param, value);
  }
  for (const value of f.skillsExclude) p.append('skills_exclude', value);
  if (f.postedWithinDays != null) p.append('posted_within_days', String(f.postedWithinDays));
  return p.toString();
}

/** The number badged on the Filters button: every selected facet value (plus
 *  excluded skills) and the posted-within choice. The free-text query is
 *  search, not a filter, so it does not count. */
export function activeFilterCount(f: JobFilters): number {
  let n = 0;
  for (const values of Object.values(f.facets)) n += values.length;
  n += f.skillsExclude.length;
  if (f.postedWithinDays != null) n += 1;
  return n;
}

/** Toggle one value in a facet: off -> selected -> off. Immutable. */
export function toggleValue(f: JobFilters, param: string, value: string): JobFilters {
  const current = f.facets[param] ?? [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  const facets = { ...f.facets };
  if (next.length) facets[param] = next;
  else delete facets[param];
  return { ...f, facets };
}

/** Cycle a skill through its three states: off -> include -> exclude -> off.
 *  The one exception to the include-only model above. Immutable. */
export function cycleSkill(f: JobFilters, skill: string): JobFilters {
  const include = f.facets.skills ?? [];
  const exclude = f.skillsExclude;

  const withSkills = (values: string[]): JobFilters['facets'] => {
    const facets = { ...f.facets };
    if (values.length) facets.skills = values;
    else delete facets.skills;
    return facets;
  };

  if (include.includes(skill)) {
    return {
      ...f,
      facets: withSkills(include.filter((s) => s !== skill)),
      skillsExclude: [...exclude, skill],
    };
  }
  if (exclude.includes(skill)) {
    return { ...f, skillsExclude: exclude.filter((s) => s !== skill) };
  }
  return { ...f, facets: withSkills([...include, skill]) };
}

/** Set the posted-within choice (null clears it). Immutable. */
export function setPostedWithin(f: JobFilters, days: number | null): JobFilters {
  return { ...f, postedWithinDays: days };
}

/** Replace the free-text query. Immutable. */
export function setQuery(f: JobFilters, q: string): JobFilters {
  return { ...f, q };
}

/** Trim, drop empties, and dedupe (order-preserving) a list of raw values into
 *  a facet's selected set. */
function seedValues(values: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of values) {
    const v = raw.trim();
    if (v) seen.add(v);
  }
  return [...seen];
}

/**
 * Build a fresh filter set seeded from a saved user profile — the reset-and-
 * seed behind "Apply profile". A direct port of the web's
 * `facetModel.ts::filtersFromProfile`, trimmed to the facets this app's model
 * has: `category` from specializations; `skills` (include) from skills and
 * (exclude) from excluded_skills, with a skill wanted in both kept as
 * include-only; `work_mode`/`regions`/`countries` flattened from
 * `location_preferences` (no `cities` or dedicated `relocation` facet exist on
 * mobile, so those parts of a profile aren't represented). `base.country` only
 * counts for `countries` when the user accepts physical work (`onsite` or
 * `hybrid`) — for a remote-only user, their home country isn't where they want
 * the job. Relocation targets only count when the user is open to relocating.
 */
export function filtersFromProfile(profile: UserProfile): JobFilters {
  const facets: Record<string, string[]> = {};
  const category = seedValues(profile.specializations);
  if (category.length) facets.category = category;

  const skills = seedValues(profile.skills);
  if (skills.length) facets.skills = skills;
  const skillsExclude = seedValues(profile.excluded_skills).filter((v) => !skills.includes(v));

  const loc = profile.location_preferences;
  if (loc) {
    const workModes = seedValues(loc.work_modes ?? []);
    if (workModes.length) facets.work_mode = workModes;

    const wantsPhysical = workModes.includes('onsite') || workModes.includes('hybrid');
    const reloc = loc.relocation.open ? loc.relocation : { regions: [], countries: [] };

    const regions = seedValues([...(loc.remote?.regions ?? []), ...(reloc.regions ?? [])]);
    if (regions.length) facets.regions = regions;

    const countries = seedValues([
      ...(loc.remote?.countries ?? []),
      ...(wantsPhysical && loc.base?.country ? [loc.base.country] : []),
      ...(reloc.countries ?? []),
    ]);
    if (countries.length) facets.countries = countries;
  }

  return { q: '', facets, skillsExclude, postedWithinDays: null };
}
