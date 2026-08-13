import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { getColors } from '@/constants/freehire';
import { AuthProvider } from '@/lib/authStore';
import { FilterProvider } from '@/lib/filterStore';
import { jobSlugFromResponse } from '@/lib/push';
import { TabBarVisibilityProvider } from '@/lib/tabBarStore';

SplashScreen.preventAutoHideAsync();

// A push that lands while the app is open is still worth seeing, so it is shown
// as a banner rather than swallowed. No sound and no badge: a job alert doesn't
// warrant interrupting someone already reading the feed, and nothing in the app
// clears a badge — setting one would strand a number on the icon forever.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// One client for the app's lifetime. `staleTime` keeps the feed from refetching
// the moment you switch tabs and back — job listings don't change second-to-second.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 2 },
  },
});

// A tapped push with a job slug in its data opens that job directly; one with
// none (e.g. a subscription digest matching several jobs) just foregrounds the
// app, which is the OS/expo-router default and needs no code here. Covers both
// a tap while the app is already running (the listener) and a tap that cold-
// starts the app (the one-time getLastNotificationResponseAsync check) —
// otherwise the deep link would only work for half of how a push gets tapped.
function useNotificationDeepLink() {
  const router = useRouter();

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const slug = jobSlugFromResponse(response);
      if (slug) router.push(`/jobs/${slug}`);
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const slug = jobSlugFromResponse(response);
      if (slug) router.push(`/jobs/${slug}`);
    });
    return () => sub.remove();
  }, [router]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const c = getColors(colorScheme);
  useNotificationDeepLink();

  // Root Stack. The `(tabs)` group owns the tab bar and renders headerless; the
  // job-detail screen pushes over it with a native back button, tinted to match
  // the freehire palette so the header reads as part of the app, not chrome.
  return (
    // Required by react-native-gesture-handler for any gesture (including the
    // feed card's swipe actions) to work — must wrap the whole app, not just
    // the screens that use gestures.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          {/* Auth + Filter state wrap the whole Stack so every screen (feed,
              detail, and the auth/filters modals) shares one source of truth. */}
          <AuthProvider>
            <FilterProvider>
              <TabBarVisibilityProvider>
                <Stack
                  screenOptions={{
                    headerStyle: { backgroundColor: c.background },
                    headerTintColor: c.brandStrong,
                    headerTitleStyle: { color: c.foreground },
                    contentStyle: { backgroundColor: c.background },
                  }}>
                  {/* The 4-tab bottom nav (Jobs/Companies/Notifications/Profile)
                      is the app's root — see (tabs)/_layout.tsx. */}
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  {/* No native header — the detail screen draws its own compact back
                      chevron so the empty header bar never eats vertical space. */}
                  <Stack.Screen name="jobs/[slug]" options={{ headerShown: false }} />
                  {/* Same no-native-header treatment as jobs/[slug] — this screen
                      draws its own compact back chevron too. */}
                  <Stack.Screen name="companies/[slug]" options={{ headerShown: false }} />
                  {/* Filters and auth present as modals over the tab bar. */}
                  <Stack.Screen name="filters" options={{ headerShown: false, presentation: 'modal' }} />
                  {/* Region + Work format only — reached via the feed search
                      bar's region shortcut, distinct from the full Filters
                      modal above. */}
                  <Stack.Screen name="filters/quick" options={{ headerShown: false, presentation: 'modal' }} />
                  <Stack.Screen name="auth" options={{ headerShown: false, presentation: 'modal' }} />
                  {/* A multi-job digest's own matched-jobs list, pushed from the
                      Notifications tab — no native header, same reasoning as
                      jobs/[slug]. */}
                  <Stack.Screen name="notifications/[id]" options={{ headerShown: false }} />
                </Stack>
              </TabBarVisibilityProvider>
            </FilterProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
