/** Below this scroll offset the bar always stays visible (dead zone near the
 *  top — no point hiding it before the user has meaningfully scrolled). */
const TOP_THRESHOLD = 40;
/** Minimum downward delta before hiding — filters out small bounces/jitter. */
const HIDE_DELTA = 8;

/**
 * The tab bar's next hidden state given the current one, the scroll delta
 * since the last event (positive = down), and the current scroll offset.
 * Framework-free so the scroll-direction rule has real unit tests instead of
 * only manual verification, unlike the rest of this UI-heavy feature.
 */
export function nextTabBarHidden(current: boolean, delta: number, offset: number): boolean {
  if (offset <= TOP_THRESHOLD) return false;
  if (delta < 0) return false;
  if (delta > HIDE_DELTA) return true;
  return current;
}
