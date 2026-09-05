import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { Chip } from '@/components/Chip';
import { SkillChip } from '@/components/SkillChip';
import { getColors, Radius, Space } from '@/constants/freehire';
import { useAuth } from '@/lib/authStore';
import { facetValueLabel } from '@/lib/format';
import { FACETS } from '@/lib/jobFilters';
import {
  cycleDraftSkill,
  draftFromProfile,
  MAX_SPECIALIZATIONS,
  profileWrite,
  skillState,
  toggleSpecialization,
  validateProfileEdit,
  type ProfileDraft,
} from '@/lib/profileEdit';
import { useDebounced } from '@/lib/useDebounced';
import { useFacetCounts } from '@/lib/useJobSearch';
import { useProfile } from '@/lib/useProfile';
import { useSaveProfile } from '@/lib/useSaveProfile';

const MAX_SKILL_OPTIONS = 40;

/** Specializations come from the same closed vocabulary the Filters screen uses,
 *  which mirrors the server's category list — an unknown value is a 400 there. */
const CATEGORIES = FACETS.find((f) => f.param === 'category')?.values ?? [];

/**
 * The profile editor: the specializations a candidate is looking in, the skills
 * they hold, and the skills they would rather avoid.
 *
 * It edits specializations as well as skills because the server requires at
 * least one of each in the same request — a "skills only" screen could not save
 * a profile for the person who has none, which is exactly who most of the
 * entry points here are sending.
 *
 * Every save is a read-modify-write: `PUT /me/profile` replaces the whole row,
 * so `profileWrite` sends back the seniorities and location preferences this
 * screen has no controls for. Losing them would be silent.
 */
export default function ProfileEditorScreen() {
  const c = getColors(useColorScheme());
  const { user } = useAuth();
  const { data: profile, isPending, isError, refetch } = useProfile();
  const save = useSaveProfile();

  // Seeded once the profile read settles; `key` on the editor body below is what
  // re-seeds it, rather than an effect that would fight the user's own edits.
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [skillQuery, setSkillQuery] = useState('');
  const [saved, setSaved] = useState(false);

  const debouncedSkillQuery = useDebounced(skillQuery, 250);
  const { data: counts } = useFacetCounts('');

  // The skill vocabulary is the live facet distribution, busiest-first: the
  // skills real postings ask for. A skill no job mentions cannot move any match.
  const skillOptions = useMemo(() => {
    const dist = counts?.facets?.skills ?? {};
    const needle = debouncedSkillQuery.trim().toLowerCase();
    return Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .filter(([skill]) => !needle || skill.toLowerCase().includes(needle))
      .slice(0, MAX_SKILL_OPTIONS);
  }, [counts, debouncedSkillQuery]);

  if (!user) {
    return (
      <Shell colors={c} title="Your profile">
        <View style={styles.statePad}>
          <Text style={[styles.line, { color: c.mutedForeground }]}>
            Sign in to build a profile.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/auth')}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: c.brand },
              pressed && { opacity: 0.85 },
            ]}>
            <Text style={[styles.primaryText, { color: c.brandForeground }]}>Sign in</Text>
          </Pressable>
        </View>
      </Shell>
    );
  }

  if (isPending) {
    return (
      <Shell colors={c} title="Your profile">
        <ActivityIndicator color={c.brand} />
      </Shell>
    );
  }

  if (isError) {
    // Saving is not offered here on purpose: a write built from a profile that
    // was never read would replace the fields this screen cannot see with
    // nothing at all.
    return (
      <Shell colors={c} title="Your profile">
        <View style={styles.statePad}>
          <Text style={[styles.line, { color: c.mutedForeground }]}>
            Couldn’t load your profile, so it can’t be edited safely.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => refetch()}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: c.brand },
              pressed && { opacity: 0.85 },
            ]}>
            <Text style={[styles.primaryText, { color: c.brandForeground }]}>Try again</Text>
          </Pressable>
        </View>
      </Shell>
    );
  }

  const current = draft ?? draftFromProfile(profile);
  const unmetRule = validateProfileEdit(current);

  function edit(next: ProfileDraft) {
    setDraft(next);
    setSaved(false);
    save.reset();
  }

  function commit() {
    if (unmetRule) return;
    save.mutate(profileWrite(current, profile), {
      onSuccess: (stored) => {
        // Render what the server stored — it lowercases, de-duplicates, and
        // subtracts the avoided set from the held one.
        setDraft(draftFromProfile(stored));
        setSaved(true);
      },
    });
  }

  const selectedSkills = [...current.skills, ...current.excludedSkills];

  return (
    <Shell colors={c} title="Your profile">
      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.foreground }]}>Specializations</Text>
          <Text style={[styles.hint, { color: c.mutedForeground }]}>
            What you’re looking for. Up to {MAX_SPECIALIZATIONS}.
          </Text>
          <View style={styles.chips}>
            {CATEGORIES.map((value) => (
              <Chip
                key={value}
                label={facetValueLabel('category', value)}
                selected={current.specializations.includes(value)}
                colors={c}
                onPress={() => edit(toggleSpecialization(current, value))}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.foreground }]}>Skills</Text>
          <Text style={[styles.hint, { color: c.mutedForeground }]}>
            Tap once for a skill you have, twice for one you’d rather avoid.
          </Text>
          <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
            <AppSymbol name="magnifyingglass" size={15} tintColor={c.mutedForeground} />
            <TextInput
              value={skillQuery}
              onChangeText={setSkillQuery}
              placeholder="Search skills…"
              placeholderTextColor={c.mutedForeground}
              autoCorrect={false}
              autoCapitalize="none"
              style={[styles.searchInput, { color: c.foreground }]}
            />
          </View>
          <View style={styles.chips}>
            {/* A chosen skill stays visible even when it falls outside the top
                slice or the current search — otherwise searching would look
                like it had cleared the profile. */}
            {selectedSkills
              .filter((skill) => !skillOptions.some(([s]) => s === skill))
              .map((skill) => (
                <SkillChip
                  key={skill}
                  label={skill}
                  state={skillState(current, skill)}
                  colors={c}
                  onPress={() => edit(cycleDraftSkill(current, skill))}
                />
              ))}
            {skillOptions.map(([skill, n]) => (
              <SkillChip
                key={skill}
                label={skill}
                count={n}
                state={skillState(current, skill)}
                colors={c}
                onPress={() => edit(cycleDraftSkill(current, skill))}
              />
            ))}
            {skillOptions.length === 0 ? (
              <Text style={[styles.line, { color: c.mutedForeground }]}>No skills found.</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
        {/* The unmet rule is named before the request, not discovered from a 400. */}
        {unmetRule ? (
          <Text style={[styles.footerNote, { color: c.mutedForeground }]}>{unmetRule}</Text>
        ) : null}
        {save.isError ? (
          <Text style={[styles.footerNote, { color: c.destructive }]}>
            Couldn’t save your profile. Your choices are still here — try again.
          </Text>
        ) : null}
        {saved && !save.isError ? (
          <Text style={[styles.footerNote, { color: c.brandStrong }]}>Profile saved.</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !!unmetRule || save.isPending }}
          disabled={!!unmetRule || save.isPending}
          onPress={commit}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: c.brand },
            (!!unmetRule || save.isPending) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}>
          <Text style={[styles.primaryText, { color: c.brandForeground }]}>
            {save.isPending ? 'Saving…' : 'Save profile'}
          </Text>
        </Pressable>
      </View>
    </Shell>
  );
}

/** The screen frame: a back chevron, a title, and whatever state fills it. */
function Shell({
  colors: c,
  title,
  children,
}: {
  colors: ReturnType<typeof getColors>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}>
          <AppSymbol name="chevron.left" size={22} weight="semibold" tintColor={c.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
      </View>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  line: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
    gap: Space.sm,
  },
  footerNote: {
    fontSize: 13,
    lineHeight: 18,
  },
  primary: {
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  /** The states that fill the screen instead of the editor get the horizontal
   *  padding the ScrollView and the footer carry for themselves. */
  statePad: {
    paddingHorizontal: Space.lg,
    gap: Space.md,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
