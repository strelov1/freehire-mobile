import { computeClientMatch } from './jobMatch';

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
