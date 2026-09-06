import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { JobCard } from '@/components/JobCard';
import { SortMenu } from '@/components/SortMenu';
import { getColors, Radius, Space } from '@/constants/freehire';
import { useDismissedJobs } from '@/lib/useDismissedJobs';
import { useFilters } from '@/lib/filterStore';
import {
  activeFilterCount,
  emptyFilters,
  matchSortNeedsSkills,
  selectedSortFor,
  setSort,
  sortOptionsFor,
} from '@/lib/jobFilters';
import { useTabBarClearance } from '@/lib/tabBarVisibility';
import { useTabBarVisibility } from '@/lib/tabBarStore';
import type { Job } from '@/lib/types';
import { useJobSearch } from '@/lib/useJobSearch';
import { useProfile } from '@/lib/useProfile';

export default function FeedScreen() {
  const tabBarClearance = useTabBarClearance();
  const c = getColors(useColorScheme());
  const { filters, appliedQuery, setQuery, apply } = useFilters();
  const { isDismissed } = useDismissedJobs();
  const { data: profile } = useProfile();
  const { reportScrollY } = useTabBarVisibility();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useJobSearch(appliedQuery);

  // Drop jobs the signed-in user just hid (swiped left on) from the rendered
  // list — belt-and-suspenders freshness alongside the backend's own dismissed
  // exclusion, so a hide takes effect on THIS page immediately rather than
  // waiting for the next fetch. See job-card-swipe-actions spec.
  const jobs = useMemo(
    () => (data?.pages.flatMap((p) => p.data) ?? []).filter((job) => !isDismissed(job.public_slug)),
    [data, isDismissed],
  );
  const total = data?.pages[0]?.meta.total ?? 0;
  const activeCount = activeFilterCount(filters);

  // The orderings on offer and the one the control shows — both pure, both in
  // jobFilters so they are testable without rendering this screen.
  const sortOptions = sortOptionsFor(filters.q);
  const selectedSort = selectedSortFor(filters);
  const needsSkills = matchSortNeedsSkills(filters, (profile?.skills?.length ?? 0) > 0);
  const selectedRegions = filters.facets.regions ?? [];
  const regionTint = selectedRegions.length > 0 ? c.brandStrong : c.mutedForeground;

  // Wipe both the search text and every filter (the empty-state escape hatch).
  const resetAll = () => {
    setQuery('');
    apply(emptyFilters);
  };

  // The pinned search bar stays put while the list scrolls. The Filters button
  // lives inside the field (trailing), and the result count sits just beneath.
  // Notifications and profile live in the bottom tab bar, not this header.
  const top = (
    <View style={styles.top}>
      <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
        <Pressable
          onPress={() => router.push('/filters/quick')}
          hitSlop={8}
          style={({ pressed }) => [
            styles.regionInInput,
            { borderRightColor: c.border },
            pressed && { opacity: 0.6 },
          ]}>
          <AppSymbol name="globe" size={17} tintColor={regionTint} />
        </Pressable>
        <AppSymbol name="magnifyingglass" size={17} tintColor={c.mutedForeground} />
        <TextInput
          value={filters.q}
          onChangeText={setQuery}
          placeholder="Search jobs…"
          placeholderTextColor={c.mutedForeground}
          style={[styles.searchInput, { color: c.foreground }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {filters.q.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <AppSymbol name="xmark.circle.fill" size={16} tintColor={c.mutedForeground} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push('/filters')}
          hitSlop={8}
          style={({ pressed }) => [
            styles.filtersInInput,
            { borderLeftColor: c.border },
            pressed && { opacity: 0.6 },
          ]}>
          <AppSymbol
            name="slider.horizontal.3"
            size={18}
            tintColor={activeCount > 0 ? c.brandStrong : c.foreground}
          />
          {activeCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: c.brand }]}>
              <Text style={[styles.badgeText, { color: c.brandForeground }]}>{activeCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
      {/* The count and the ordering on one line, the web's toolbar in miniature.
          Ordering is not filtering: it applies on the tap rather than behind the
          Filters modal's "Show N jobs" button, because it is changed often and
          its whole point is seeing the effect. */}
      <View style={styles.toolbar}>
        <Text style={[styles.count, { color: c.mutedForeground }]}>
          {total > 0 ? `${total.toLocaleString('en-US')} jobs` : ''}
        </Text>
        <SortMenu
          options={sortOptions}
          selected={selectedSort}
          onSelect={(sort) => apply(setSort(filters, sort))}
        />
      </View>

      {/* Best match is offered to everyone, so it can be chosen by someone with
          nothing to rank against. The server quietly serves newest in that case;
          said out loud, that reads as a profile to fill in rather than as a sort
          that is broken. */}
      {needsSkills ? (
        <Text style={[styles.sortNotice, { color: c.mutedForeground }]}>
          Best match ranks against your profile skills — add some to use it.
        </Text>
      ) : null}
    </View>
  );

  // The list area swaps between loading / error / empty / results; the pinned
  // top (search + toolbar) stays mounted around it either way.
  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={c.brand} />
      </View>
    );
  } else if (isError && jobs.length === 0) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          Couldn’t load jobs.{'\n'}
          {(error as Error)?.message ?? 'Please try again.'}
        </Text>
        <Text onPress={() => refetch()} style={[styles.retry, { color: c.brand }]}>
          Tap to retry
        </Text>
      </View>
    );
  } else if (jobs.length === 0) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          No jobs match your search.
        </Text>
        {filters.q || activeCount > 0 ? (
          <Text onPress={resetAll} style={[styles.retry, { color: c.brand }]}>
            Clear search & filters
          </Text>
        ) : null}
      </View>
    );
  } else {
    body = (
      <FlashList<Job>
        data={jobs}
        keyExtractor={(job) => job.public_slug}
        renderItem={({ item }) => <JobCard job={item} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
        ItemSeparatorComponent={() => <View style={{ height: Space.md }} />}
        keyboardDismissMode="on-drag"
        onScroll={(e) => reportScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            tintColor={c.brand}
            colors={[c.brand]}
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={c.brand} />
            </View>
          ) : null
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.background }]}>
      {top}
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Space.md, padding: Space.xl },
  top: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    paddingBottom: Space.sm,
    gap: Space.sm,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingLeft: Space.md,
    paddingRight: Space.sm,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  filtersInInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    paddingLeft: Space.sm,
    marginLeft: Space.xs,
    borderLeftWidth: 1,
  },
  regionInInput: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingRight: Space.sm,
    marginRight: Space.xs,
    borderRightWidth: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingBottom: Space.sm,
  },
  sortNotice: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: Space.lg,
    paddingBottom: Space.sm,
  },
  count: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    // The bottom clearance is applied inline from `useTabBarClearance()`: the
    // safe-area inset it includes is only known at runtime.
  },
  footer: {
    paddingVertical: Space.lg,
  },
  stateText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  retry: {
    fontSize: 15,
    fontWeight: '600',
  },
});
