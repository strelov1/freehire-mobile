import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { getColors } from '@/constants/freehire';
import { AuthProvider } from '@/lib/authStore';
import { FilterProvider } from '@/lib/filterStore';

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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const c = getColors(colorScheme);

  // Root Stack. The `(tabs)` group owns the tab bar and renders headerless; the
  // job-detail screen pushes over it with a native back button, tinted to match
  // the freehire palette so the header reads as part of the app, not chrome.
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {/* Auth + Filter state wrap the whole Stack so every screen (feed,
            detail, and the auth/filters modals) shares one source of truth. */}
        <AuthProvider>
          <FilterProvider>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: c.background },
                headerTintColor: c.brandStrong,
                headerTitleStyle: { color: c.foreground },
                contentStyle: { backgroundColor: c.background },
              }}>
              {/* The feed is the app's single root screen (no bottom tab bar). */}
              <Stack.Screen name="index" options={{ headerShown: false }} />
              {/* No native header — the detail screen draws its own compact back
                  chevron so the empty header bar never eats vertical space. */}
              <Stack.Screen name="jobs/[slug]" options={{ headerShown: false }} />
              {/* Filters, auth, and profile all present as modals over the feed. */}
              <Stack.Screen name="filters" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="auth" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="profile" options={{ headerShown: false, presentation: 'modal' }} />
            </Stack>
          </FilterProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
