import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getColors, Radius, Space } from '@/constants/freehire';
import { useAuth } from '@/lib/authStore';
import { useFilters } from '@/lib/filterStore';
import { facetValueLabel } from '@/lib/format';
import {
  cycleSkill,
  emptyFilters,
  FACETS,
  filtersFromProfile,
  filtersToQuery,
  POSTED_WITHIN,
  setPostedWithin,
  toggleValue,
  type JobFilters,
} from '@/lib/jobFilters';
import { useFacetCounts } from '@/lib/useJobSearch';
import { useProfile } from '@/lib/useProfile';

const MAX_COUNTRIES = 30;
const MAX_SKILLS = 30;

// Stable reference so the `countries` useMemo below doesn't invalidate every
// render while `counts` is still loading.
const EMPTY_FACETS: Record<string, Record<string, number>> = {};

/** Debounce a value so rapid staging taps don't refetch counts on every tap. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * The Filters screen — a full-screen modal that edits a STAGED copy of the
 * filters (seeded from the live store when it opens). It fetches disjunctive
 * facet counts for the staged set to show a live "Show N jobs" total and
 * per-value counts, and commits to the store only when the user taps that
 * button. Dismissing without applying leaves the feed untouched. v1 covers the
 * MVP facets; the country list is data-driven from the facet distribution.
 */
export default function FiltersScreen() {
  const c = getColors(useColorScheme());
  const { filters, apply } = useFilters();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  // Seed once from the live filters; edits stay local until "Show N jobs".
  const [staged, setStaged] = useState<JobFilters>(() => filters);
  const [countryQuery, setCountryQuery] = useState('');
  const [skillQuery, setSkillQuery] = useState('');

  const stagedQuery = useMemo(() => filtersToQuery(staged), [staged]);
  const debouncedQuery = useDebounced(stagedQuery, 250);
  const { data: counts, isFetching } = useFacetCounts(debouncedQuery);

  const total = counts?.total;
  const facetCountsMap = counts?.facets ?? EMPTY_FACETS;

  // Countries, busiest-first, filtered by the search box (ISO2 code).
  const countries = useMemo(() => {
    const dist = facetCountsMap.countries ?? {};
    const needle = countryQuery.trim().toLowerCase();
    return Object.entries(dist)
      .filter(([code]) => code.length === 2) // drop the odd non-ISO bucket
      .sort((a, b) => b[1] - a[1])
      .filter(([code]) => !needle || code.toLowerCase().includes(needle))
      .slice(0, MAX_COUNTRIES);
  }, [facetCountsMap, countryQuery]);

  const selectedCountries = staged.facets.countries ?? [];

  // Skills, busiest-first, filtered by the search box — the one facet with
  // include/exclude, so each option cycles off -> include -> exclude -> off.
  const skills = useMemo(() => {
    const dist = facetCountsMap.skills ?? {};
    const needle = skillQuery.trim().toLowerCase();
    return Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .filter(([skill]) => !needle || skill.toLowerCase().includes(needle))
      .slice(0, MAX_SKILLS);
  }, [facetCountsMap, skillQuery]);

  const includedSkills = staged.facets.skills ?? [];
  const excludedSkills = staged.skillsExclude;

  // Signed out: always show it (tapping opens sign-in). Signed in: only once
  // the profile fetch has settled with a real profile — hidden while loading
  // and hidden for a signed-in user who hasn't saved one yet (mobile has
  // nowhere to send them to create one).
  const showApplyProfile = !user || (!profileLoading && profile != null);

  function applyProfile() {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!profile) return;
    setStaged(filtersFromProfile(profile));
    setCountryQuery('');
    setSkillQuery('');
  }

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
    setStaged({ ...emptyFilters, q: staged.q }); // keep the search text
    setCountryQuery('');
    setSkillQuery('');
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.foreground }]}>Filters</Text>
        <View style={styles.headerActions}>
          {showApplyProfile ? (
            <Pressable
              onPress={applyProfile}
              style={({ pressed }) => [
                styles.applyProfile,
                { backgroundColor: c.brand },
                pressed && { opacity: 0.85 },
              ]}>
              <SymbolView name="person.crop.circle" size={14} weight="semibold" tintColor={c.brandForeground} />
              <Text style={[styles.applyProfileText, { color: c.brandForeground }]}>Apply profile</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <SymbolView name="xmark" size={20} weight="semibold" tintColor={c.foreground} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
        {FACETS.map((facet) => (
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

        {/* Skills — data-driven, searchable, busiest-first; the one facet
            with include/exclude (tap cycles off -> include -> exclude -> off). */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.foreground }]}>Skills</Text>
          <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
            <SymbolView name="magnifyingglass" size={15} tintColor={c.mutedForeground} />
            <TextInput
              value={skillQuery}
              onChangeText={setSkillQuery}
              placeholder="Search skills…"
              placeholderTextColor={c.mutedForeground}
              autoCorrect={false}
              style={[styles.searchInput, { color: c.foreground }]}
            />
          </View>
          <View style={styles.chips}>
            {/* Keep any selected/excluded skill visible even if not in the top slice. */}
            {[...includedSkills, ...excludedSkills]
              .filter((skill) => !skills.some(([s]) => s === skill))
              .map((skill) => (
                <SkillChip
                  key={skill}
                  label={skill}
                  state={includedSkills.includes(skill) ? 'include' : 'exclude'}
                  colors={c}
                  onPress={() => setStaged((s) => cycleSkill(s, skill))}
                />
              ))}
            {skills.map(([skill, n]) => (
              <SkillChip
                key={skill}
                label={skill}
                count={n}
                state={includedSkills.includes(skill) ? 'include' : excludedSkills.includes(skill) ? 'exclude' : 'off'}
                colors={c}
                onPress={() => setStaged((s) => cycleSkill(s, skill))}
              />
            ))}
            {skills.length === 0 ? (
              <Text style={[styles.empty, { color: c.mutedForeground }]}>No skills.</Text>
            ) : null}
          </View>
        </View>

        {/* Posted within — single choice. */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.foreground }]}>Posted within</Text>
          <View style={styles.chips}>
            {POSTED_WITHIN.map((preset) => {
              const selected = staged.postedWithinDays === preset.days;
              return (
                <Chip
                  key={preset.label}
                  label={preset.label}
                  selected={selected}
                  colors={c}
                  onPress={() => setStaged((s) => setPostedWithin(s, preset.days))}
                />
              );
            })}
          </View>
        </View>

        {/* Country — data-driven, searchable, busiest-first. */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.foreground }]}>Country</Text>
          <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
            <SymbolView name="magnifyingglass" size={15} tintColor={c.mutedForeground} />
            <TextInput
              value={countryQuery}
              onChangeText={setCountryQuery}
              placeholder="Search country code…"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.searchInput, { color: c.foreground }]}
            />
          </View>
          <View style={styles.chips}>
            {/* Keep any selected country visible even if not in the top slice. */}
            {selectedCountries
              .filter((code) => !countries.some(([c2]) => c2 === code))
              .map((code) => (
                <Chip
                  key={code}
                  label={code.toUpperCase()}
                  selected
                  colors={c}
                  onPress={() => setStaged((s) => toggleValue(s, 'countries', code))}
                />
              ))}
            {countries.map(([code, n]) => (
              <Chip
                key={code}
                label={code.toUpperCase()}
                count={n}
                selected={selectedCountries.includes(code)}
                colors={c}
                onPress={() => setStaged((s) => toggleValue(s, 'countries', code))}
              />
            ))}
            {countries.length === 0 ? (
              <Text style={[styles.empty, { color: c.mutedForeground }]}>No countries.</Text>
            ) : null}
          </View>
        </View>
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

function Chip({
  label,
  count,
  selected,
  colors,
  onPress,
}: {
  label: string;
  count?: number;
  selected: boolean;
  colors: ReturnType<typeof getColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: colors.brandMuted, borderColor: colors.brand }
          : { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}>
      <Text
        style={[styles.chipText, { color: selected ? colors.brandStrong : colors.foreground }]}>
        {label}
      </Text>
      {count != null ? (
        <Text style={[styles.chipCount, { color: selected ? colors.brandStrong : colors.mutedForeground }]}>
          {count.toLocaleString('en-US')}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A skill's three states: unselected, wanted (include), or avoided (exclude).
 *  Tapping cycles through them (see `cycleSkill`). Reuses the app's one
 *  existing "destructive" color (`auth.tsx`'s error text) since there's no
 *  palette token for it yet. */
const EXCLUDE_COLOR = '#dc2626';

function SkillChip({
  label,
  count,
  state,
  colors,
  onPress,
}: {
  label: string;
  count?: number;
  state: 'off' | 'include' | 'exclude';
  colors: ReturnType<typeof getColors>;
  onPress: () => void;
}) {
  let stateStyle;
  let textColor;
  switch (state) {
    case 'include':
      stateStyle = { backgroundColor: colors.brandMuted, borderColor: colors.brand };
      textColor = colors.brandStrong;
      break;
    case 'exclude':
      stateStyle = { backgroundColor: colors.card, borderColor: EXCLUDE_COLOR };
      textColor = EXCLUDE_COLOR;
      break;
    default:
      stateStyle = { backgroundColor: colors.card, borderColor: colors.border };
      textColor = colors.foreground;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, stateStyle, pressed && { opacity: 0.7 }]}>
      <Text
        style={[
          styles.chipText,
          { color: textColor },
          state === 'exclude' && { textDecorationLine: 'line-through' },
        ]}>
        {label}
      </Text>
      {count != null ? (
        <Text style={[styles.chipCount, { color: state === 'off' ? colors.mutedForeground : textColor }]}>
          {count.toLocaleString('en-US')}
        </Text>
      ) : null}
    </Pressable>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  applyProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    height: 34,
  },
  applyProfileText: {
    fontSize: 13,
    fontWeight: '600',
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipCount: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.md,
    height: 38,
    marginBottom: Space.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  empty: {
    fontSize: 13,
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
