import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Space } from '@/constants/freehire';

/** Below this scroll offset the bar always stays visible (dead zone near the
 *  top — no point hiding it before the user has meaningfully scrolled). */
const TOP_THRESHOLD = 40;
/** Minimum downward delta before hiding — filters out small bounces/jitter. */
const HIDE_DELTA = 8;

/** The custom tab bar's fixed height (excludes the device's bottom safe
 *  area, which the bar adds on top of this). Shared so tab screens can pad
 *  their scrollable content to clear it. */
export const TAB_BAR_HEIGHT = 52;

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

/**
 * The bottom padding a tab screen's scrolling content needs so its last row
 * clears the floating tab bar.
 *
 * The bar is `TAB_BAR_HEIGHT` PLUS the device's bottom safe-area inset (see
 * `(tabs)/_layout.tsx`, which sizes it that way), and no tab screen wraps its
 * scroll in a `SafeAreaView` with a bottom edge — they all take `['top']` only.
 * So the inset belongs here. Every screen had `Space.xl + TAB_BAR_HEIGHT`
 * instead, which is short by exactly the inset: on a home-indicator device the
 * last ~34px of every tab sat under the bar, which is how Profile's last
 * control — Delete Account — ended up half-swallowed by it.
 *
 * A hook rather than a constant because the inset is only known at runtime,
 * and shared because five screens needing the same clearance is five chances
 * to get it wrong once.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return Space.xl + TAB_BAR_HEIGHT + insets.bottom;
}
