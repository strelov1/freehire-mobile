import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { ApplicationCard } from '@/components/ApplicationCard';
import { getColors, Radius, Space } from '@/constants/freehire';
import { useAuth } from '@/lib/authStore';
import { TAB_BAR_HEIGHT } from '@/lib/tabBarVisibility';
import {
  deriveFilterCounts,
  FILTER_LABELS,
  filterTrackedJobs,
  TRACKER_FILTERS,
  type TrackerFilter,
} from '@/lib/tracker';
import type { TrackedJob } from '@/lib/types';
import { useTrackedJobs } from '@/lib/useTracker';

export default function TrackerScreen() {
  const c = getColors(useColorScheme());
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<TrackerFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, isError, error, refetch, isRefetching } = useTrackedJobs('board');

  const allJobs: TrackedJob[] = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;
  const isCapped = Boolean(meta && meta.total > allJobs.length);

  const filterCounts = useMemo(() => deriveFilterCounts(allJobs), [allJobs]);

  const filteredJobs = useMemo(
    () => filterTrackedJobs(allJobs, selectedFilter, searchQuery),
    [allJobs, selectedFilter, searchQuery],
  );

  if (!user) {
    return (
      <SafeAreaView edges={['top']} style={[styles.fill, styles.center, { backgroundColor: c.background }]}>
        <View style={[styles.guestCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <AppSymbol name="tray.2.fill" size={36} tintColor={c.brandStrong} />
          <Text style={[styles.guestTitle, { color: c.foreground }]}>Track your applications</Text>
          <Text style={[styles.guestBody, { color: c.mutedForeground }]}>
            Save jobs, record submission dates, and track your interview progress across all stages in one place.
          </Text>
          <Pressable
            onPress={() => router.push('/auth')}
            accessibilityRole="button"
            accessibilityLabel="Sign in or create account"
            style={({ pressed }) => [
              styles.signInButton,
              { backgroundColor: c.brand },
              pressed && { opacity: 0.8 },
            ]}>
            <Text style={[styles.signInButtonText, { color: c.brandForeground }]}>
              Sign in to use Tracker
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.background }]}>
      {/* Pinned Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.headerTitle, { color: c.foreground }]}>Applications</Text>
          {allJobs.length > 0 ? (
            <View style={[styles.totalBadge, { backgroundColor: c.muted }]}>
              <Text style={[styles.totalBadgeText, { color: c.brandStrong }]}>
                {allJobs.length}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: c.card, borderColor: c.border }]}>
          <AppSymbol name="magnifyingglass" size={16} tintColor={c.mutedForeground} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search role or company…"
            placeholderTextColor={c.mutedForeground}
            style={[styles.searchInput, { color: c.foreground }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}>
              <AppSymbol name="xmark.circle.fill" size={16} tintColor={c.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Chips Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}>
          {TRACKER_FILTERS.map((filter) => {
            const count = filterCounts[filter];
            const isSelected = selectedFilter === filter;
            const label = `${FILTER_LABELS[filter]} ${count}`;

            return (
              <Pressable
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                accessibilityRole="button"
                accessibilityState={isSelected ? { selected: true } : {}}
                accessibilityLabel={`Filter by ${FILTER_LABELS[filter]}, ${count} jobs`}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isSelected ? c.brandMuted : c.card,
                    borderColor: isSelected ? c.brand : c.border,
                  },
                  pressed && { opacity: 0.75 },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? c.brandStrong : c.mutedForeground,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Bounded 500 Warning if server has more rows than returned */}
        {isCapped ? (
          <View style={[styles.cappedWarning, { backgroundColor: c.muted, borderColor: c.border }]}>
            <AppSymbol name="exclamationmark.circle" size={14} tintColor={c.brandStrong} />
            <Text style={[styles.cappedText, { color: c.foreground }]}>
              Showing first {allJobs.length} of {meta?.total} applications.
            </Text>
          </View>
        ) : null}
      </View>

      {/* Main Body */}
      {isLoading ? (
        <View style={[styles.fill, styles.center]}>
          <ActivityIndicator color={c.brand} />
        </View>
      ) : isError && allJobs.length === 0 ? (
        <View style={[styles.fill, styles.center, { padding: Space.xl }]}>
          <Text style={[styles.stateText, { color: c.mutedForeground }]}>
            Couldn’t load applications.{'\n'}
            {(error as Error)?.message ?? 'Please try again.'}
          </Text>
          <Pressable
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading applications"
            style={styles.retryButton}>
            <Text style={[styles.retryText, { color: c.brand }]}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : allJobs.length === 0 ? (
        <View style={[styles.fill, styles.center, { padding: Space.xl }]}>
          <AppSymbol name="tray.2" size={40} tintColor={c.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: c.foreground }]}>No applications yet</Text>
          <Text style={[styles.emptyBody, { color: c.mutedForeground }]}>
            Save jobs from the Jobs feed to track them here, or record applications you’ve submitted.
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)')}
            accessibilityRole="button"
            accessibilityLabel="Browse jobs"
            style={({ pressed }) => [
              styles.browseButton,
              { backgroundColor: c.brand },
              pressed && { opacity: 0.8 },
            ]}>
            <Text style={[styles.browseButtonText, { color: c.brandForeground }]}>
              Browse jobs
            </Text>
          </Pressable>
        </View>
      ) : filteredJobs.length === 0 ? (
        <View style={[styles.fill, styles.center, { padding: Space.xl }]}>
          <AppSymbol name="magnifyingglass" size={32} tintColor={c.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: c.foreground }]}>No matching applications</Text>
          <Text style={[styles.emptyBody, { color: c.mutedForeground }]}>
            Try changing the stage filter or search term.
          </Text>
          <Pressable
            onPress={() => {
              setSelectedFilter('all');
              setSearchQuery('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Reset filters"
            style={styles.retryButton}>
            <Text style={[styles.retryText, { color: c.brand }]}>Reset filters</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList<TrackedJob>
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ApplicationCard
              item={item}
              onPress={() => router.push({ pathname: '/tracker/[id]' as any, params: { id: item.id } })}
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Space.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={c.brand}
              colors={[c.brand]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.md,
  },
  header: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    paddingBottom: Space.xs,
    gap: Space.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  totalBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
  },
  totalBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.sm,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  chipsRow: {
    gap: Space.xs,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.sm + 2,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
  },
  cappedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
  },
  cappedText: {
    fontSize: 11,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xs,
    paddingBottom: Space.xl + TAB_BAR_HEIGHT,
  },
  guestCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Space.xl,
    alignItems: 'center',
    textAlign: 'center',
    gap: Space.sm,
    marginHorizontal: Space.lg,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: Space.xs,
  },
  guestBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  signInButton: {
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    marginTop: Space.sm,
  },
  signInButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    padding: Space.xs,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: Space.xs,
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  browseButton: {
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm + 2,
    marginTop: Space.sm,
  },
  browseButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
