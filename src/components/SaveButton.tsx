import { router } from 'expo-router';
import { Pressable, useColorScheme } from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors } from '@/constants/freehire';
import { useAuth } from '@/lib/authStore';
import { useSavedJobs } from '@/lib/useSavedJobs';

/**
 * A bookmark toggle for one job. Always visible: signed out, a tap opens the
 * auth modal (matching the web's gate); signed in, it toggles the saved state
 * optimistically. Nested inside the card's Pressable, its own press is absorbed
 * here so tapping the bookmark never navigates to the detail screen.
 */
export function SaveButton({ slug, size = 22 }: { slug: string; size?: number }) {
  const c = getColors(useColorScheme());
  const { user, recordReturnIntent } = useAuth();
  const { isSaved, toggle } = useSavedJobs();
  const saved = isSaved(slug);

  function onPress() {
    if (!user) {
      recordReturnIntent({ kind: 'saveJob', jobSlug: slug, fallbackDestination: 'job' });
      router.push('/auth');
      return;
    }
    toggle(slug, saved);
  }

  const iconColor = saved ? c.brandStrong : c.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove bookmark' : 'Save job'}
      style={({ pressed }) => pressed && { opacity: 0.5 }}>
      <AppSymbol
        name={saved ? 'bookmark.fill' : 'bookmark'}
        size={size}
        tintColor={iconColor}
      />
    </Pressable>
  );
}
