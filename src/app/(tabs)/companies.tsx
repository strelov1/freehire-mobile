import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
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
import { Chip } from '@/components/Chip';
import { CompanyCard } from '@/components/CompanyCard';
import { getColors, Radius, Space } from '@/constants/freehire';
import { DEFAULT_COMPANY_SORT, type CompanySort } from '@/lib/companyList';
import { TAB_BAR_HEIGHT } from '@/lib/tabBarVisibility';
import type { CompanyListItem } from '@/lib/types';
import { useCompanySearch } from '@/lib/useCompanySearch';
import { useDebounced } from '@/lib/useDebounced';

/** Long enough that a typed word lands as one request, short enough that the
 *  list still feels like it reacts to typing. */
const SEARCH_DEBOUNCE_MS = 300;

const SORTS: { value: CompanySort; label: string; a11y: string }[] = [
  { value: 'job_count', label: 'Most active', a11y: 'Sort by open roles' },
  { value: 'rating', label: 'Top rated', a11y: 'Sort by rating' },
];

/**
 * The company directory. Same skeleton as the job feed (`(tabs)/index.tsx`):
 * a pinned header that stays mounted across every state, and a body that swaps
 * between loading / error / empty / results.
 *
 * The typed text drives the field; only its debounced form reaches
 * `useCompanySearch`, which keys its cache on it — so typing costs no requests
 * and a settled word costs exactly one. The sort, a discrete choice rather than
 * a stream of keystrokes, applies immediately.
 */
export default function CompaniesScreen() {
  const c = getColors(useColorScheme());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CompanySort>(DEFAULT_COMPANY_SORT);
  const settledQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);

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
  } = useCompanySearch(settledQuery, sort);

  const companies = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const total = data?.pages[0]?.meta.total ?? 0;

  const header = (
    <View style={styles.top}>
      <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
        <AppSymbol name="magnifyingglass" size={17} tintColor={c.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search companies…"
          placeholderTextColor={c.mutedForeground}
          style={[styles.searchInput, { color: c.foreground }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search">
            <AppSymbol name="xmark.circle.fill" size={16} tintColor={c.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.toolbar}>
        {total > 0 ? (
          <Text style={[styles.count, { color: c.mutedForeground }]}>
            {total.toLocaleString('en-US')} {total === 1 ? 'company' : 'companies'}
          </Text>
        ) : null}
        {/* Two orders only, so a pair of chips beats a picker sheet — see this
            change's design note on the sort control. */}
        <View style={styles.sorts}>
          {SORTS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={sort === option.value}
              colors={c}
              onPress={() => setSort(option.value)}
              accessibilityLabel={option.a11y}
            />
          ))}
        </View>
      </View>
    </View>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={c.brand} />
      </View>
    );
  } else if (isError && companies.length === 0) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          Couldn’t load companies.{'\n'}
          {(error as Error)?.message ?? 'Please try again.'}
        </Text>
        <Text
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          style={[styles.action, { color: c.brand }]}>
          Tap to retry
        </Text>
      </View>
    );
  } else if (companies.length === 0) {
    body = (
      <View style={[styles.fill, styles.center]}>
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          {query ? 'No companies match your search.' : 'No companies yet.'}
        </Text>
        {query ? (
          <Text
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={[styles.action, { color: c.brand }]}>
            Clear search
          </Text>
        ) : null}
      </View>
    );
  } else {
    body = (
      <FlashList<CompanyListItem>
        data={companies}
        keyExtractor={(item) => item.slug}
        renderItem={({ item }) => <CompanyCard company={item} />}
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
      {header}
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
    paddingHorizontal: Space.md,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  count: {
    flexShrink: 1,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  sorts: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 6,
  },
  listContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    // Clears the custom bottom tab bar, same as the feed's list.
    paddingBottom: Space.xl + TAB_BAR_HEIGHT,
  },
  footer: {
    paddingVertical: Space.lg,
  },
  stateText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    fontSize: 15,
    fontWeight: '600',
  },
});
