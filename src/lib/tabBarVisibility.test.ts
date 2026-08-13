import { nextTabBarHidden } from './tabBarVisibility';

describe('nextTabBarHidden', () => {
  it('hides when scrolling down past the top threshold', () => {
    expect(nextTabBarHidden(false, 20, 100)).toBe(true);
  });

  it('shows when scrolling up, even while hidden', () => {
    expect(nextTabBarHidden(true, -5, 200)).toBe(false);
  });

  it('stays visible near the top regardless of direction', () => {
    expect(nextTabBarHidden(false, 20, 10)).toBe(false);
  });

  it('forces visible when scrolled back within the top threshold', () => {
    expect(nextTabBarHidden(true, 5, 10)).toBe(false);
  });

  it('keeps current state for a small downward jiggle below the delta threshold', () => {
    expect(nextTabBarHidden(false, 3, 100)).toBe(false);
    expect(nextTabBarHidden(true, 3, 100)).toBe(true);
  });
});
