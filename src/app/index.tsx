import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
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

import { JobCard } from '@/components/JobCard';
import { getColors, Radius, Space } from '@/constants/freehire';
import { useAuth } from '@/lib/authStore';
import { useFilters } from '@/lib/filterStore';
import { activeFilterCount, emptyFilters } from '@/lib/jobFilters';
import type { Job } from '@/lib/types';
import { useJobSearch } from '@/lib/useJobSearch';

export default function FeedScreen() {
  const c = getColors(useColorScheme());
  const { filters, appliedQuery, setQuery, apply } = useFilters();
  const { user } = useAuth();
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

  const jobs = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const total = data?.pages[0]?.meta.total ?? 0;
  const activeCount = activeFilterCount(filters);

  // Wipe both the search text and every filter (the empty-state escape hatch).
  const resetAll = () => {
    setQuery('');
    apply(emptyFilters);
  };

  // The pinned search bar stays put while the list scrolls. The Filters button
  // lives inside the field (trailing), and the result count sits just beneath.
  const top = (
    <View style={styles.top}>
      {/* Search and the profile entry share one row — the field flexes and ends
          just before the avatar. Signed out the avatar opens the auth modal;
          signed in, the profile screen. */}
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
          <SymbolView name="magnifyingglass" size={17} tintColor={c.mutedForeground} />
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
          <Pressable
            onPress={() => router.push('/filters')}
            hitSlop={8}
            style={({ pressed }) => [
              styles.filtersInInput,
              { borderLeftColor: c.border },
              pressed && { opacity: 0.6 },
            ]}>
            <SymbolView
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

        <Pressable
          onPress={() => router.push(user ? '/profile' : '/auth')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={user ? 'Profile' : 'Sign in'}
          style={({ pressed }) => [styles.account, pressed && { opacity: 0.6 }]}>
          <SymbolView
            name={user ? 'person.crop.circle.fill' : 'person.crop.circle'}
            size={30}
            tintColor={user ? c.brandStrong : c.foreground}
          />
        </Pressable>
      </View>
      {total > 0 ? (
        <Text style={[styles.count, { color: c.mutedForeground }]}>
          {total.toLocaleString('en-US')} jobs
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
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: Space.md }} />}
        keyboardDismissMode="on-drag"
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  account: {
    padding: 2,
  },
  search: {
    flex: 1,
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
    paddingBottom: Space.xl,
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
