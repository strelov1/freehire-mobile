import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space } from '@/constants/freehire';
import { useNotification } from '@/lib/useNotifications';

/** A compact back affordance — mirrors the job-detail screen's BackButton
 *  exactly (chevron only, pops the stack or falls back to the feed). */
function BackButton({ color }: { color: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}>
      <AppSymbol name="chevron.left" size={22} weight="semibold" tintColor={color} />
    </Pressable>
  );
}

/**
 * The jobs a multi-job subscription digest actually matched, as a snapshot
 * taken at delivery time — not a live re-run of the saved search, which can
 * drift (a listing here may since have closed or dropped out of a fresh
 * search). Reached by tapping a NotificationCard whose `public_slug` is null
 * but `jobs` isn't (see notifications.tsx's onPressCard); also a valid deep
 * link on its own, so it fetches its own data rather than expecting router
 * state to carry it.
 */
export default function DigestJobsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = getColors(useColorScheme());
  const numericId = id ? Number(id) : undefined;
  const { data: item, isLoading, isError } = useNotification(numericId);

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={c.brand} />
      </View>
    );
  } else if (isError || !item) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          This notification doesn’t exist, or isn’t yours.
        </Text>
      </View>
    );
  } else if (!item.jobs || item.jobs.length === 0) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          No jobs recorded for this notification.
        </Text>
      </View>
    );
  } else {
    body = (
      <ScrollView contentContainerStyle={styles.listContent}>
        {item.jobs.map((job) => (
          <Pressable
            key={job.slug}
            onPress={() => router.push(`/jobs/${job.slug}`)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: c.card, borderColor: c.border },
              pressed && { opacity: 0.7 },
            ]}>
            <Text style={[styles.jobTitle, { color: c.foreground }]}>{job.title}</Text>
            <Text style={[styles.jobCompany, { color: c.mutedForeground }]}>{job.company}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <BackButton color={c.foreground} />
        <Text style={[styles.headerTitle, { color: c.foreground }]} numberOfLines={1}>
          {item?.title ?? 'Matched jobs'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Space.md, padding: Space.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  back: { width: 28 },
  headerSpacer: { width: 28 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xs,
    paddingBottom: Space.xl,
    gap: Space.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Space.md,
    gap: 2,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  jobCompany: {
    fontSize: 13,
    lineHeight: 18,
  },
  stateText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
});
