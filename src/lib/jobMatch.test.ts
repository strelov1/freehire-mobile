import {
  computeClientMatch,
  matchBarSegments,
  matchHasGroups,
  resolveMatchState,
} from './jobMatch';

describe('computeClientMatch', () => {
  it('counts a partial case-insensitive overlap', () => {
    expect(computeClientMatch(['React', 'Go', 'SQL'], ['react', 'sql'])).toEqual({
      total: 3,
      matched: 2,
      percent: 67,
    });
  });

  it('counts a full overlap as 100%', () => {
    expect(computeClientMatch(['React', 'SQL'], ['react', 'sql'])).toEqual({
      total: 2,
      matched: 2,
      percent: 100,
    });
  });

  it('counts zero overlap as 0%', () => {
    expect(computeClientMatch(['React', 'Go'], ['rust', 'sql'])).toEqual({
      total: 2,
      matched: 0,
      percent: 0,
    });
  });

  it('returns a zero match for empty job skills without dividing by zero', () => {
    expect(computeClientMatch([], ['react', 'sql'])).toEqual({ total: 0, matched: 0, percent: 0 });
  });

  it('returns a zero match for empty profile skills', () => {
    expect(computeClientMatch(['React', 'SQL'], [])).toEqual({ total: 2, matched: 0, percent: 0 });
  });
});

describe('resolveMatchState', () => {
  const ready = {
    jobSkills: ['react', 'go'],
    authenticated: true,
    profileLoaded: true,
    profileSkills: ['react'],
  };

  it('is ready for a signed-in viewer whose loaded profile has skills', () => {
    expect(resolveMatchState(ready)).toBe('ready');
  });

  it('is no-skills for a job carrying none', () => {
    expect(resolveMatchState({ ...ready, jobSkills: [] })).toBe('no-skills');
  });

  it('prefers no-skills over every personal gate', () => {
    // A signed-out viewer on a skill-less job is told there is nothing to
    // compare, not invited to sign in for a comparison that cannot exist.
    expect(
      resolveMatchState({
        jobSkills: [],
        authenticated: false,
        profileLoaded: false,
        profileSkills: null,
      }),
    ).toBe('no-skills');
  });

  it('is guest for a signed-out viewer', () => {
    expect(resolveMatchState({ ...ready, authenticated: false })).toBe('guest');
  });

  it('is loading while a signed-in viewer’s profile is in flight', () => {
    // Held apart from no-profile so the block does not flash a call-to-action
    // that the settled profile is about to remove.
    expect(resolveMatchState({ ...ready, profileLoaded: false, profileSkills: null })).toBe(
      'loading',
    );
  });

  it('is no-profile for a settled profile with no skills', () => {
    expect(resolveMatchState({ ...ready, profileSkills: [] })).toBe('no-profile');
    expect(resolveMatchState({ ...ready, profileSkills: null })).toBe('no-profile');
  });

  it('is no-skills for a job whose skills exist only in enrichment', () => {
    // The caller passes `job.skills` alone: the server matches on the dictionary
    // facet, so resolving through the screen's `skills || enrichment.skills`
    // fallback would buy a request that answers `total: 0`.
    expect(resolveMatchState({ ...ready, jobSkills: [] })).toBe('no-skills');
  });
});

describe('matchHasGroups', () => {
  it('has groups once a ready state carries a match with skills', () => {
    expect(matchHasGroups('ready', { total: 3 })).toBe(true);
  });

  it('has no groups while the request is still out', () => {
    // `ready` means a request was allowed, not that it came back — and the
    // screen keeps its own skill row until there is something to replace it.
    expect(matchHasGroups('ready', undefined)).toBe(false);
    expect(matchHasGroups('ready', null)).toBe(false);
  });

  it('has no groups when the server found nothing to compare', () => {
    expect(matchHasGroups('ready', { total: 0 })).toBe(false);
  });

  it('has no groups in any locked state', () => {
    expect(matchHasGroups('guest', { total: 3 })).toBe(false);
    expect(matchHasGroups('no-profile', { total: 3 })).toBe(false);
    expect(matchHasGroups('loading', { total: 3 })).toBe(false);
    expect(matchHasGroups('no-skills', { total: 3 })).toBe(false);
  });
});

describe('matchBarSegments', () => {
  it('draws an adjacent skill at half the weight of an exact one', () => {
    // 5 skills, 2 exact, 1 adjacent — the spec's worked case, reported as 50%.
    expect(matchBarSegments({ total: 5, exact_count: 2, adjacent_count: 1 })).toEqual({
      exact: 40,
      adjacent: 10,
    });
  });

  it('sums the two segments to the unrounded coverage percent', () => {
    const segments = matchBarSegments({ total: 3, exact_count: 2, adjacent_count: 1 });
    expect(segments.exact + segments.adjacent).toBeCloseTo((2 + 0.5) / 3 * 100);
  });

  it('fills the track for an all-exact match', () => {
    expect(matchBarSegments({ total: 2, exact_count: 2, adjacent_count: 0 })).toEqual({
      exact: 100,
      adjacent: 0,
    });
  });

  it('draws nothing for a job with no skills instead of dividing by zero', () => {
    expect(matchBarSegments({ total: 0, exact_count: 0, adjacent_count: 0 })).toEqual({
      exact: 0,
      adjacent: 0,
    });
  });
});
