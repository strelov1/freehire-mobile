import {
  activeFilterCount,
  cycleSkill,
  emptyFilters,
  filtersFromProfile,
  filtersToQuery,
  setPostedWithin,
  setQuery,
  toggleValue,
  type JobFilters,
} from './jobFilters';
import type { LocationPreferences, UserProfile } from './types';

describe('filtersToQuery', () => {
  it('is empty for the empty filter set', () => {
    expect(filtersToQuery(emptyFilters)).toBe('');
  });

  it('serializes a free-text query as q', () => {
    expect(filtersToQuery({ ...emptyFilters, q: 'react' })).toBe('q=react');
  });

  it('repeats a multi-value facet param once per value', () => {
    const f: JobFilters = { ...emptyFilters, facets: { work_mode: ['remote', 'hybrid'] } };
    expect(filtersToQuery(f)).toBe('work_mode=remote&work_mode=hybrid');
  });

  it('emits posted_within_days only when set', () => {
    expect(filtersToQuery({ ...emptyFilters, postedWithinDays: 7 })).toBe('posted_within_days=7');
    expect(filtersToQuery({ ...emptyFilters, postedWithinDays: null })).toBe('');
  });

  it('orders q, then facets, then posted_within_days', () => {
    const f: JobFilters = {
      q: 'designer',
      facets: { work_mode: ['remote'] },
      skillsExclude: [],
      postedWithinDays: 30,
    };
    expect(filtersToQuery(f)).toBe('q=designer&work_mode=remote&posted_within_days=30');
  });

  it('serializes included skills as skills and excluded skills as skills_exclude', () => {
    const f: JobFilters = {
      ...emptyFilters,
      facets: { skills: ['go', 'kubernetes'] },
      skillsExclude: ['php'],
    };
    expect(filtersToQuery(f)).toBe('skills=go&skills=kubernetes&skills_exclude=php');
  });

  it('omits skills_exclude when no skill is excluded', () => {
    const f: JobFilters = { ...emptyFilters, facets: { skills: ['go'] } };
    expect(filtersToQuery(f)).toBe('skills=go');
  });
});

describe('activeFilterCount', () => {
  it('is zero for the empty set (a bare query is not a filter)', () => {
    expect(activeFilterCount(emptyFilters)).toBe(0);
    expect(activeFilterCount({ ...emptyFilters, q: 'react' })).toBe(0);
  });

  it('sums every selected facet value plus posted-within', () => {
    const f: JobFilters = {
      q: '',
      facets: { work_mode: ['remote', 'hybrid'], seniority: ['senior'] },
      skillsExclude: [],
      postedWithinDays: 7,
    };
    expect(activeFilterCount(f)).toBe(4);
  });

  it('counts excluded skills too', () => {
    const f: JobFilters = { ...emptyFilters, facets: { skills: ['go'] }, skillsExclude: ['php', 'wordpress'] };
    expect(activeFilterCount(f)).toBe(3);
  });
});

describe('cycleSkill', () => {
  it('cycles a skill off -> include -> exclude -> off, immutably', () => {
    const included = cycleSkill(emptyFilters, 'go');
    expect(included.facets.skills).toEqual(['go']);
    expect(included.skillsExclude).toEqual([]);
    expect(emptyFilters.facets.skills).toBeUndefined(); // original untouched

    const excluded = cycleSkill(included, 'go');
    expect(excluded.facets.skills ?? []).toEqual([]);
    expect(excluded.skillsExclude).toEqual(['go']);

    const off = cycleSkill(excluded, 'go');
    expect(off.facets.skills ?? []).toEqual([]);
    expect(off.skillsExclude).toEqual([]);
  });

  it('keeps other skills untouched', () => {
    let f = cycleSkill(emptyFilters, 'go');
    f = cycleSkill(f, 'python');
    expect(f.facets.skills).toEqual(['go', 'python']);
    f = cycleSkill(f, 'go'); // go -> exclude
    expect(f.facets.skills).toEqual(['python']);
    expect(f.skillsExclude).toEqual(['go']);
  });
});

// Build a UserProfile with just the fields filtersFromProfile reads.
function mkProfile(
  specializations: string[],
  skills: string[],
  location: LocationPreferences | null = null,
  excludedSkills: string[] = [],
): UserProfile {
  return {
    specializations,
    skills,
    // Not read by filtersFromProfile — carried because the type now covers every
    // writable field, the profile editor having to send back what it didn't edit.
    seniorities: [],
    excluded_skills: excludedSkills,
    location_preferences: location,
  };
}

describe('filtersFromProfile', () => {
  it('seeds category from specializations and skills from skills, and nothing else', () => {
    const f = filtersFromProfile(mkProfile(['backend', 'devops'], ['go', 'kubernetes']));
    expect(f.facets.category).toEqual(['backend', 'devops']);
    expect(f.facets.skills).toEqual(['go', 'kubernetes']);
    expect(Object.keys(f.facets).sort()).toEqual(['category', 'skills']);
  });

  it('starts from a clean slate (independent of any prior state)', () => {
    const f = filtersFromProfile(mkProfile(['frontend'], ['react']));
    expect(f.q).toEqual(emptyFilters.q);
    expect(f.skillsExclude).toEqual(emptyFilters.skillsExclude);
    expect(f.postedWithinDays).toEqual(emptyFilters.postedWithinDays);
  });

  it('trims and dedupes seeded values, and drops empties', () => {
    const f = filtersFromProfile(mkProfile([' backend ', 'backend', ''], ['go', 'go', '  ']));
    expect(f.facets.category).toEqual(['backend']);
    expect(f.facets.skills).toEqual(['go']);
  });

  it('empty inputs yield an empty filter set', () => {
    const f = filtersFromProfile(mkProfile([], []));
    expect(f.facets).toEqual({});
    expect(f.skillsExclude).toEqual([]);
  });

  it('flattens the location block', () => {
    const location: LocationPreferences = {
      work_modes: ['remote', 'onsite'],
      remote: { regions: ['latam'], countries: ['br'] },
      base: { country: 'br', city: 'Florianópolis' },
      relocation: { open: true, regions: ['eu'], countries: [] },
    };
    const f = filtersFromProfile(mkProfile(['backend'], ['go'], location));
    expect(f.facets.work_mode).toEqual(['remote', 'onsite']);
    // regions = remote ∪ relocation targets.
    expect(f.facets.regions).toEqual(['latam', 'eu']);
    // countries = remote ∪ base (onsite is in work_modes); base 'br' dedupes against remote 'br'.
    expect(f.facets.countries).toEqual(['br']);
  });

  it('seeds no relocation-derived values when the user is not open to relocating', () => {
    const location: LocationPreferences = {
      remote: { regions: ['latam'] },
      relocation: { open: false, regions: ['eu'], countries: ['de'] },
    };
    const f = filtersFromProfile(mkProfile(['backend'], ['go'], location));
    expect(f.facets.regions).toEqual(['latam']);
    expect(f.facets.countries ?? []).toEqual([]);
  });

  it('seeds the skills exclude set from excluded_skills', () => {
    const f = filtersFromProfile(mkProfile(['backend'], ['go'], null, ['php', 'wordpress']));
    expect(f.facets.skills).toEqual(['go']);
    expect(f.skillsExclude).toEqual(['php', 'wordpress']);
  });

  it('keeps a skill wanted when it also appears in excluded_skills (include wins)', () => {
    const f = filtersFromProfile(mkProfile(['backend'], ['go'], null, ['go', 'php']));
    expect(f.facets.skills).toEqual(['go']);
    expect(f.skillsExclude).toEqual(['php']);
  });

  it('does not seed countries from base for a remote-only user', () => {
    const location: LocationPreferences = {
      work_modes: ['remote'],
      remote: { regions: ['latam'] },
      base: { country: 'co', city: 'Manizales' },
      relocation: { open: false },
    };
    const f = filtersFromProfile(mkProfile(['backend'], ['go'], location));
    expect(f.facets.work_mode).toEqual(['remote']);
    expect(f.facets.regions).toEqual(['latam']);
    expect(f.facets.countries ?? []).toEqual([]);
  });

  it('still seeds countries from base for a hybrid user', () => {
    const location: LocationPreferences = {
      work_modes: ['hybrid'],
      remote: { regions: [] },
      base: { country: 'co', city: 'Manizales' },
      relocation: { open: false },
    };
    const f = filtersFromProfile(mkProfile(['backend'], ['go'], location));
    expect(f.facets.countries).toEqual(['co']);
  });

  it('a profile with no location block seeds only category and skills', () => {
    const f = filtersFromProfile(mkProfile(['backend'], ['go'], null));
    expect(f.facets.category).toEqual(['backend']);
    expect(f.facets.skills).toEqual(['go']);
    for (const param of ['work_mode', 'regions', 'countries']) {
      expect(f.facets[param] ?? []).toEqual([]);
    }
  });
});

describe('toggleValue', () => {
  it('adds a value when off, and is immutable', () => {
    const next = toggleValue(emptyFilters, 'work_mode', 'remote');
    expect(next.facets.work_mode).toEqual(['remote']);
    expect(emptyFilters.facets.work_mode).toBeUndefined(); // original untouched
  });

  it('removes the value on the second toggle (include -> off)', () => {
    const on = toggleValue(emptyFilters, 'work_mode', 'remote');
    const off = toggleValue(on, 'work_mode', 'remote');
    expect(off.facets.work_mode ?? []).toEqual([]);
  });

  it('keeps other values in the same facet', () => {
    let f = toggleValue(emptyFilters, 'seniority', 'senior');
    f = toggleValue(f, 'seniority', 'lead');
    expect(f.facets.seniority).toEqual(['senior', 'lead']);
    f = toggleValue(f, 'seniority', 'senior');
    expect(f.facets.seniority).toEqual(['lead']);
  });
});

describe('setters', () => {
  it('setQuery replaces q immutably', () => {
    const f = setQuery(emptyFilters, 'go');
    expect(f.q).toBe('go');
    expect(emptyFilters.q).toBe('');
  });

  it('setPostedWithin sets and clears', () => {
    expect(setPostedWithin(emptyFilters, 14).postedWithinDays).toBe(14);
    expect(setPostedWithin({ ...emptyFilters, postedWithinDays: 14 }, null).postedWithinDays).toBeNull();
  });
});
