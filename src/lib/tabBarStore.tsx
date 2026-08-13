import { createContext, useCallback, useContext, useMemo, useRef, type PropsWithChildren } from 'react';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { nextTabBarHidden } from '@/lib/tabBarVisibility';

type TabBarVisibility = {
  /** 0 = shown, 1 = hidden — normalized, not a pixel offset. The bar itself
   *  (which knows its real height including the bottom safe-area inset)
   *  multiplies this by that height to get the actual `translateY`. */
  hidden: SharedValue<number>;
  /** Feed a raw scroll-view `contentOffset.y` in; drives `hidden`. */
  reportScrollY: (offsetY: number) => void;
};

const TabBarVisibilityContext = createContext<TabBarVisibility | null>(null);

/** Shares one Reanimated value for the bottom tab bar's hide/show
 *  animation between the Jobs feed (which reports scroll position) and the
 *  tab bar itself (which reads it) — siblings in the tree, so this can't
 *  flow through props. Mount once, above the `(tabs)` navigator. Normalized
 *  (0/1) rather than a pixel offset because this provider sits above the
 *  safe-area context and doesn't know the bar's real height. */
export function TabBarVisibilityProvider({ children }: PropsWithChildren) {
  const hidden = useSharedValue(0);
  const lastOffsetRef = useRef(0);
  const hiddenRef = useRef(false);

  const reportScrollY = useCallback(
    (offsetY: number) => {
      const delta = offsetY - lastOffsetRef.current;
      lastOffsetRef.current = offsetY;

      const nextHidden = nextTabBarHidden(hiddenRef.current, delta, offsetY);
      if (nextHidden === hiddenRef.current) return;
      hiddenRef.current = nextHidden;
      // Mutating `.value` is Reanimated's documented, worklet-safe way to drive
      // a SharedValue — the compiler's general immutability rule doesn't yet
      // recognize that exception, so it misreads this as illegal hook-value mutation.
      // eslint-disable-next-line react-hooks/immutability
      hidden.value = withTiming(nextHidden ? 1 : 0, { duration: 200 });
    },
    [hidden],
  );

  const value = useMemo<TabBarVisibility>(
    () => ({ hidden, reportScrollY }),
    [hidden, reportScrollY],
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility(): TabBarVisibility {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) throw new Error('useTabBarVisibility must be used within a TabBarVisibilityProvider');
  return ctx;
}
