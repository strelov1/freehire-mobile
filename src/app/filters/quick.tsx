import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/Chip';
import { getColors, Radius, Space } from '@/constants/freehire';
import { useFilters } from '@/lib/filterStore';
import { facetValueLabel } from '@/lib/format';
import { FACETS, QUICK_FACET_PARAMS, filtersToQuery, toggleValue, type JobFilters } from '@/lib/jobFilters';
import { useDebounced } from '@/lib/useDebounced';
import { useFacetCounts } from '@/lib/useJobSearch';

const QUICK_FACETS = FACETS.filter((f) => QUICK_FACET_PARAMS.includes(f.param));

// Stable reference so the counts useMemo below doesn't invalidate every
// render while `counts` is still loading.
const EMPTY_FACETS: Record<string, Record<string, number>> = {};

/**
 * Region + Work format only — a lighter sibling of the full Filters screen,
 * reached from the feed's region shortcut button. Same staged-copy +
 * live-count + "Show N jobs" pattern as `/filters`, scoped to two facets so
 * it opens straight to what the shortcut promised instead of a full list.
 */
export default function QuickFiltersScreen() {
  const c = getColors(useColorScheme());
  const { filters, apply } = useFilters();

  // Seed once from the live filters; edits stay local until "Show N jobs".
  const [staged, setStaged] = useState<JobFilters>(() => filters);

  const stagedQuery = useMemo(() => filtersToQuery(staged), [staged]);
  const debouncedQuery = useDebounced(stagedQuery, 250);
  const { data: counts, isFetching } = useFacetCounts(debouncedQuery);

  const total = counts?.total;
  const facetCountsMap = counts?.facets ?? EMPTY_FACETS;

  function commit() {
    apply(staged);
    router.back();
  }

  // The commit button's label: the live matching total once known, otherwise a
  // loading hint (first open) or a plain fallback.
  function showLabel(): string {
    if (total != null) return `Show ${total.toLocaleString('en-US')} jobs`;
    return isFetching ? 'Show…' : 'Show jobs';
  }

  function clearAll() {
    setStaged((s) => {
      const facets = { ...s.facets };
      for (const param of QUICK_FACET_PARAMS) delete facets[param];
      return { ...s, facets };
    });
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.foreground }]}>Quick filters</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <SymbolView name="xmark" size={20} weight="semibold" tintColor={c.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
        {QUICK_FACETS.map((facet) => (
          <View key={facet.param} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: c.foreground }]}>{facet.label}</Text>
            <View style={styles.chips}>
              {facet.values.map((value) => {
                const selected = (staged.facets[facet.param] ?? []).includes(value);
                const n = facetCountsMap[facet.param]?.[value];
                return (
                  <Chip
                    key={value}
                    label={facetValueLabel(facet.param, value)}
                    count={n}
                    selected={selected}
                    colors={c}
                    onPress={() => setStaged((s) => toggleValue(s, facet.param, value))}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Sticky footer: clear + commit. */}
      <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
        <Pressable onPress={clearAll} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <Text style={[styles.clear, { color: c.mutedForeground }]}>Clear all</Text>
        </Pressable>
        <Pressable
          onPress={commit}
          style={({ pressed }) => [styles.show, { backgroundColor: c.brand }, pressed && { opacity: 0.85 }]}>
          <Text style={[styles.showText, { color: c.brandForeground }]}>{showLabel()}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.xl,
    gap: Space.xl,
  },
  section: {
    gap: Space.sm,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.lg,
    borderTopWidth: 1,
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
  },
  clear: {
    fontSize: 15,
    fontWeight: '600',
  },
  show: {
    flex: 1,
    maxWidth: 260,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  showText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
