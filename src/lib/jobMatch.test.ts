import {
  blockerTone,
  computeClientMatch,
  matchBarSegments,
  matchHasGroups,
  matchTeaser,
  partitionBlockers,
  resolveMatchState,
  teaserChips,
} from './jobMatch';
import type { Blocker } from './types';

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

describe('matchTeaser', () => {
  const skills = ['react', 'typescript', 'graphql', 'nodejs', 'aws'];

  it('derives the same figures for the same job every time', () => {
    // A card that re-rolled its score as a FlatList remounted it would be caught
    // out immediately — the figure changing under the user's thumb.
    const first = matchTeaser('stripe-senior-engineer', skills);
    const second = matchTeaser('stripe-senior-engineer', skills);

    expect(first?.percent).toBe(second?.percent);
    expect([...(first?.missing ?? [])]).toEqual([...(second?.missing ?? [])]);
  });

  it('keeps the percent inside the teaser band for any slug', () => {
    for (const slug of ['a', 'stripe-eng', 'x'.repeat(64), 'ジョブ', '']) {
      const teaser = matchTeaser(slug, skills);
      expect(teaser).not.toBeNull();
      expect(teaser!.percent).toBeGreaterThanOrEqual(60);
      expect(teaser!.percent).toBeLessThanOrEqual(90);
    }
  });

  it('derives the matched count from the percent, so the label cannot contradict the bar', () => {
    for (const slug of ['a', 'b', 'c', 'd', 'e']) {
      const teaser = matchTeaser(slug, skills)!;
      expect(teaser.matched).toBe(Math.round((teaser.percent / 100) * teaser.total));
    }
  });

  it('always leaves at least one skill held and at least one missing', () => {
    for (const count of [2, 3, 4, 5, 8, 13]) {
      const many = Array.from({ length: count }, (_, i) => `skill_${i}`);
      for (const slug of ['a', 'b', 'c']) {
        const teaser = matchTeaser(slug, many)!;
        expect(teaser.missing.size).toBeGreaterThan(0);
        expect(teaser.missing.size).toBeLessThan(count);
      }
    }
  });

  it('yields nothing for a job with fewer than two skills', () => {
    // There is no have/missing story in one skill, and "1 of 1 skills" beside a
    // part-filled bar is the one figure a viewer could disprove.
    expect(matchTeaser('slug', ['react'])).toBeNull();
    expect(matchTeaser('slug', [])).toBeNull();
  });
});

describe('teaserChips', () => {
  it('takes the leading skills when they already show both tones', () => {
    const missing = new Set(['typescript']);
    expect(teaserChips(['react', 'typescript', 'graphql'], missing, 3)).toEqual([
      'react',
      'typescript',
      'graphql',
    ]);
  });

  it('trades its last chip for a missing skill when the window came out all-held', () => {
    // Otherwise the row reads uniformly held under a bar that isn't full.
    const missing = new Set(['aws']);
    expect(teaserChips(['react', 'typescript', 'graphql', 'aws'], missing, 3)).toEqual([
      'react',
      'typescript',
      'aws',
    ]);
  });

  it('leaves a one-chip row alone rather than inverting its contrast', () => {
    const missing = new Set(['aws']);
    expect(teaserChips(['react', 'aws'], missing, 1)).toEqual(['react']);
  });
});

describe('partitionBlockers', () => {
  function blocker(over: Partial<Blocker>): Blocker {
    return {
      category: 'experience',
      severity: 'medium',
      score_cap: 70,
      reason: 'Needs 5 years, your CV shows 3',
      action: '',
      met: false,
      ...over,
    };
  }

  it('splits the unmet from the met', () => {
    const { unmet, met } = partitionBlockers([
      blocker({ category: 'work_authorization', met: false }),
      blocker({ category: 'education', met: true }),
    ]);

    expect(unmet.map((b) => b.category)).toEqual(['work_authorization']);
    expect(met.map((b) => b.category)).toEqual(['education']);
  });

  it('puts the hardest unmet constraint first', () => {
    // A lower score cap is a harder blocker.
    const { unmet } = partitionBlockers([
      blocker({ category: 'language', score_cap: 80 }),
      blocker({ category: 'work_authorization', score_cap: 20 }),
      blocker({ category: 'experience', score_cap: 50 }),
    ]);

    expect(unmet.map((b) => b.category)).toEqual([
      'work_authorization',
      'experience',
      'language',
    ]);
  });

  it('reads a missing list as no blockers rather than erroring', () => {
    // The server sends an empty array for a caller with no structured résumé.
    expect(partitionBlockers(undefined)).toEqual({ unmet: [], met: [] });
    expect(partitionBlockers(null)).toEqual({ unmet: [], met: [] });
    expect(partitionBlockers([])).toEqual({ unmet: [], met: [] });
  });
});

describe('blockerTone', () => {
  it('reads a hard constraint as blocking and a soft one as a quiet note', () => {
    // A work permit the candidate lacks must not read like a preference unmet.
    expect(blockerTone('hard')).toBe('destructive');
    expect(blockerTone('medium')).toBe('warningStrong');
    expect(blockerTone('soft')).toBe('mutedForeground');
  });

  it('falls back to the quiet tone for a severity it does not know', () => {
    expect(blockerTone('something_new')).toBe('mutedForeground');
  });
});
