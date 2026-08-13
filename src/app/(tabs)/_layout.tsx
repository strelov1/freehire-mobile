import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { getColors, Space } from '@/constants/freehire';
import { useTabBarVisibility } from '@/lib/tabBarStore';
import { TAB_BAR_HEIGHT } from '@/lib/tabBarVisibility';
import { useUnreadCount } from '@/lib/useNotifications';

const ROUTE_META: Record<string, { label: string; icon: SFSymbol; iconFilled: SFSymbol }> = {
  index: { label: 'Jobs', icon: 'briefcase', iconFilled: 'briefcase.fill' },
  companies: { label: 'Companies', icon: 'building.2', iconFilled: 'building.2.fill' },
  notifications: { label: 'Notifications', icon: 'bell', iconFilled: 'bell.fill' },
  profile: { label: 'Profile', icon: 'person.crop.circle', iconFilled: 'person.crop.circle.fill' },
};

/**
 * The custom bottom tab bar: same tab-switching contract React Navigation
 * expects from a `tabBar` render prop, plus the scroll-driven slide animation
 * `TabBarVisibilityProvider` exposes. A custom bar (over the default
 * `tabBarStyle`) is what makes a smooth hide/show possible instead of a
 * layout-jumping `display` toggle.
 */
function AnimatedTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const c = getColors(useColorScheme());
  const { translateY } = useTabBarVisibility();
  const { data: unreadCount = 0 } = useUnreadCount();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        animatedStyle,
        {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: c.card,
          borderTopColor: c.border,
        },
      ]}>
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
              <SymbolView name={focused ? meta.iconFilled : meta.icon} size={24} tintColor={tint} />
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
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: Space.sm,
  },
  label: {
    fontSize: 11,
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
