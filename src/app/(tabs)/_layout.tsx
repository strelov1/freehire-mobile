import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import type { SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space } from '@/constants/freehire';
import { useTabBarVisibility } from '@/lib/tabBarStore';
import { TAB_BAR_HEIGHT } from '@/lib/tabBarVisibility';
import { useUnreadCount } from '@/lib/useNotifications';

const ROUTE_META: Record<string, { label: string; icon: SFSymbol; iconFilled: SFSymbol }> = {
  index: { label: 'Jobs', icon: 'briefcase', iconFilled: 'briefcase.fill' },
  companies: { label: 'Companies', icon: 'building.2', iconFilled: 'building.2.fill' },
  tracker: { label: 'Tracker', icon: 'tray.2', iconFilled: 'tray.2.fill' },
  notifications: { label: 'Notifications', icon: 'bell', iconFilled: 'bell.fill' },
  profile: { label: 'Profile', icon: 'person.crop.circle', iconFilled: 'person.crop.circle.fill' },
};

/** Width of the sliding active-tab indicator line. */
const INDICATOR_WIDTH = 28;

/**
 * The custom bottom tab bar: same tab-switching contract React Navigation
 * expects from a `tabBar` render prop, plus the scroll-driven slide animation
 * `TabBarVisibilityProvider` exposes. A custom bar (over the default
 * `tabBarStyle`) is what makes a smooth hide/show possible instead of a
 * layout-jumping `display` toggle. Also draws a thin indicator line above
 * the focused tab that slides between tabs on switch.
 */
function AnimatedTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const c = getColors(useColorScheme());
  const { hidden } = useTabBarVisibility();
  const { data: unreadCount = 0 } = useUnreadCount();
  const [barWidth, setBarWidth] = useState(0);

  // The bar's real height includes the bottom safe-area inset; `hidden` is
  // normalized (0/1) since the shared value doesn't know that inset, so the
  // pixel translateY is computed here, where `insets` is available.
  const barHeight = TAB_BAR_HEIGHT + insets.bottom;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden.value * barHeight }],
  }));

  const tabWidth = barWidth / state.routes.length;
  const indicatorX = useSharedValue(0);
  useEffect(() => {
    indicatorX.value = withTiming(state.index * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2, {
      duration: 200,
    });
  }, [state.index, tabWidth, indicatorX]);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <Animated.View
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      style={[
        styles.bar,
        animatedStyle,
        {
          height: barHeight,
          paddingBottom: insets.bottom,
          backgroundColor: c.card,
          borderTopColor: c.border,
        },
      ]}>
      {barWidth > 0 ? (
        <Animated.View
          style={[styles.indicator, indicatorStyle, { backgroundColor: c.brandStrong }]}
        />
      ) : null}
      {state.routes.map((route, index) => {
        const meta = ROUTE_META[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const tint = focused ? c.brandStrong : c.mutedForeground;
        const badge = route.name === 'notifications' && unreadCount > 0 ? unreadCount : null;

        return (
          <Pressable
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={meta.label}>
            <View>
              <AppSymbol name={focused ? meta.iconFilled : meta.icon} size={21} tintColor={tint} />
              {badge != null ? (
                <View style={[styles.badge, { backgroundColor: c.brand }]}>
                  <Text style={[styles.badgeText, { color: c.brandForeground }]}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color: tint }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AnimatedTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="companies" />
      <Tabs.Screen name="tracker" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: INDICATOR_WIDTH,
    height: 2,
    borderRadius: Radius.pill,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingTop: Space.xs,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
