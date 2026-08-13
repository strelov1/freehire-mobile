import { createContext, useCallback, useContext, useMemo, useRef, type PropsWithChildren } from 'react';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { nextTabBarHidden, TAB_BAR_HEIGHT } from '@/lib/tabBarVisibility';

type TabBarVisibility = {
  /** 0 = shown, `TAB_BAR_HEIGHT` = fully hidden below the screen edge. */
  translateY: SharedValue<number>;
  /** Feed a raw scroll-view `contentOffset.y` in; drives `translateY`. */
  reportScrollY: (offsetY: number) => void;
};

const TabBarVisibilityContext = createContext<TabBarVisibility | null>(null);

/** Shares one Reanimated value for the bottom tab bar's hide/show
 *  animation between the Jobs feed (which reports scroll position) and the
 *  tab bar itself (which reads it) — siblings in the tree, so this can't
 *  flow through props. Mount once, above the `(tabs)` navigator. */
export function TabBarVisibilityProvider({ children }: PropsWithChildren) {
  const translateY = useSharedValue(0);
  const lastOffsetRef = useRef(0);
  const hiddenRef = useRef(false);

  const reportScrollY = useCallback(
    (offsetY: number) => {
      const delta = offsetY - lastOffsetRef.current;
      lastOffsetRef.current = offsetY;

      const hidden = nextTabBarHidden(hiddenRef.current, delta, offsetY);
      if (hidden === hiddenRef.current) return;
      hiddenRef.current = hidden;
      // Mutating `.value` is Reanimated's documented, worklet-safe way to drive
      // a SharedValue — the compiler's general immutability rule doesn't yet
      // recognize that exception, so it misreads this as illegal hook-value mutation.
      // eslint-disable-next-line react-hooks/immutability
      translateY.value = withTiming(hidden ? TAB_BAR_HEIGHT : 0, { duration: 200 });
    },
    [translateY],
  );

  const value = useMemo<TabBarVisibility>(
    () => ({ translateY, reportScrollY }),
    [translateY, reportScrollY],
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
