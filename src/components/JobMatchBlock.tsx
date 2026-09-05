import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space, type FreehirePalette } from '@/constants/freehire';
import {
  blockerTone,
  matchBarSegments,
  matchHasGroups,
  matchTeaser,
  partitionBlockers,
  teaserChips,
  type MatchState,
  type MatchTeaser,
} from '@/lib/jobMatch';
import type { JobMatchResult } from '@/lib/types';

/** One skill chip. The three tones are the block's whole vocabulary: brand for a
 *  skill held outright, amber for one held only through a neighbour, red for one
 *  missing. `via` rides in the label as well as on screen so the "close" reading
 *  survives into a screen reader, where the colour does not. */
function SkillChip({
  skill,
  via,
  tone,
  colors: c,
}: {
  skill: string;
  via?: string;
  tone: 'have' | 'close' | 'missing';
  colors: FreehirePalette;
}) {
  const fill =
    tone === 'have' ? c.brandMuted : tone === 'close' ? c.warningMuted : c.destructiveMuted;
  const text = tone === 'have' ? c.brandStrong : tone === 'close' ? c.warningStrong : c.destructive;

  return (
    <View
      accessible
      accessibilityLabel={via ? `${skill}, close — you have ${via}` : skill}
      style={[styles.chip, { backgroundColor: fill }]}>
      <Text style={[styles.chipText, { color: text }]}>
        {skill}
        {via ? <Text style={styles.chipVia}> · {via}</Text> : null}
      </Text>
    </View>
  );
}

/** How many teaser chips the block's width takes without wrapping to a third row. */
const TEASER_CHIP_LIMIT = 6;

/**
 * The locked-state teaser: plausible figures over the job's OWN skills, blurred.
 *
 * Hidden from assistive technology in full. A screen reader being read "87%
 * match" would be told a number about the user that nobody computed — the blur
 * is what marks it as an invitation for a sighted viewer, and there is no blur
 * in an accessibility tree. The call-to-action beside it stays reachable, and
 * that is what a screen reader gets instead.
 */
function LockedTeaser({
  jobSkills,
  teaser,
  colors: c,
}: {
  jobSkills: string[];
  teaser: MatchTeaser;
  colors: FreehirePalette;
}) {
  const scheme = useColorScheme();
  const chips = teaserChips(jobSkills, teaser.missing, TEASER_CHIP_LIMIT);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.teaser}>
      <View style={styles.percentRow}>
        <Text style={[styles.percent, { color: c.foreground }]}>{teaser.percent}%</Text>
        <Text style={[styles.counts, { color: c.mutedForeground }]}>
          {teaser.matched} of {teaser.total} skills
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.muted }]}>
        <View style={[styles.fill, { backgroundColor: c.brand, width: `${teaser.percent}%` }]} />
      </View>
      <View style={styles.chips}>
        {chips.map((skill) => (
          <SkillChip
            key={skill}
            skill={skill}
            tone={teaser.missing.has(skill) ? 'missing' : 'have'}
            colors={c}
          />
        ))}
      </View>
      {/* The blur sits over the figures rather than being a property of them, so
          nothing underneath has to know it is being teased. */}
      <BlurView
        intensity={12}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** A named row of chips. Absent entirely when it has none — three headings, two
 *  of them over nothing, read as a fault rather than as an empty group. */
function SkillGroup({
  title,
  children,
  colors: c,
}: {
  title: string;
  children: React.ReactNode;
  colors: FreehirePalette;
}) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: c.mutedForeground }]}>{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

/**
 * The job-detail screen's profile-match block.
 *
 * Pure presentation: the screen owns `useJobMatch` (it needs the same answer to
 * decide whether to keep its own skill row) and hands the result down, so this
 * renders without a network or a query client.
 *
 * Five states, exactly one of which shows a match. The locked ones — `guest` and
 * `no-profile` — carry a line and a way out rather than the web's blurred
 * teaser; that teaser is its own change.
 */
export function JobMatchBlock({
  state,
  match,
  isError,
  slug,
  jobSkills,
}: {
  state: MatchState;
  match: JobMatchResult | null | undefined;
  isError: boolean;
  /** Seeds the locked teaser, so one job reads the same on every render. */
  slug: string;
  /** The job's own skills — what the teaser is built from, never a fabricated list. */
  jobSkills: string[];
}) {
  const c = getColors(useColorScheme());
  const teaser = matchTeaser(slug, jobSkills);

  const card = [styles.card, { backgroundColor: c.card, borderColor: c.border }];
  const heading = (
    <Text style={[styles.heading, { color: c.mutedForeground }]}>Profile match</Text>
  );

  if (state === 'no-skills' || (state === 'ready' && match && match.total === 0)) {
    // `total: 0` from the server lands here too: an empty comparison is nothing
    // to compare, not a candidate scoring zero.
    return (
      <View style={card}>
        {heading}
        <Text style={[styles.line, { color: c.mutedForeground }]}>
          Not enough data to compare this job to your profile.
        </Text>
      </View>
    );
  }

  if (state === 'guest') {
    return (
      <View style={card}>
        {heading}
        {teaser ? <LockedTeaser jobSkills={jobSkills} teaser={teaser} colors={c} /> : null}
        <View style={styles.ctaRow}>
          <Text style={[styles.line, styles.ctaText, { color: c.mutedForeground }]}>
            Sign in to see how this job matches your skills.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/auth')}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.brand },
              pressed && { opacity: 0.85 },
            ]}>
            <Text style={[styles.ctaLabel, { color: c.brandForeground }]}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (state === 'no-profile') {
    return (
      <View style={card}>
        {heading}
        {teaser ? <LockedTeaser jobSkills={jobSkills} teaser={teaser} colors={c} /> : null}
        <View style={styles.ctaRow}>
          <Text style={[styles.line, styles.ctaText, { color: c.mutedForeground }]}>
            Add skills to your profile to see how this job matches them.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/account/profile')}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.brand },
              pressed && { opacity: 0.85 },
            ]}>
            <Text style={[styles.ctaLabel, { color: c.brandForeground }]}>Add skills</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (state === 'loading' || (state === 'ready' && !match && !isError)) {
    return (
      <View style={card}>
        {heading}
        <ActivityIndicator color={c.brand} />
      </View>
    );
  }

  if (!matchHasGroups(state, match) || !match) {
    // Quiet by design. The match is a personal extra on a screen whose subject is
    // the job; the screen puts its own skill row back, so nothing is lost.
    return (
      <View style={card}>
        {heading}
        <Text style={[styles.line, { color: c.mutedForeground }]}>
          Couldn’t work out your match for this job.
        </Text>
      </View>
    );
  }

  const segments = matchBarSegments(match);
  const held = match.exact_count + match.adjacent_count;
  const requirements = partitionBlockers(match.blockers);

  return (
    <View style={card}>
      {heading}

      <View style={styles.percentRow}>
        <Text style={[styles.percent, { color: c.foreground }]}>{match.coverage_percent}%</Text>
        <Text style={[styles.counts, { color: c.mutedForeground }]}>
          {held} of {match.total} skills
        </Text>
      </View>

      {/* One label for the whole bar: two unlabelled views announced separately
          would be noise, and the figure is what the bar is for. */}
      <View
        accessible
        accessibilityLabel={`${match.coverage_percent}% match, ${held} of ${match.total} skills`}
        style={[styles.track, { backgroundColor: c.muted }]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.fill, { backgroundColor: c.brand, width: `${segments.exact}%` }]}
        />
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.fill, { backgroundColor: c.warning, width: `${segments.adjacent}%` }]}
        />
      </View>

      {match.matched.length > 0 ? (
        <SkillGroup title="You have" colors={c}>
          {match.matched.map((skill) => (
            <SkillChip key={skill} skill={skill} tone="have" colors={c} />
          ))}
        </SkillGroup>
      ) : null}

      {match.adjacent.length > 0 ? (
        <SkillGroup title="Close" colors={c}>
          {match.adjacent.map((a) => (
            <SkillChip key={a.name} skill={a.name} via={a.via} tone="close" colors={c} />
          ))}
        </SkillGroup>
      ) : null}

      {match.missing.length > 0 ? (
        <SkillGroup title="Missing" colors={c}>
          {match.missing.map((skill) => (
            <SkillChip key={skill} skill={skill} tone="missing" colors={c} />
          ))}
        </SkillGroup>
      ) : null}

      {/* The deterministic hard-constraint checks the same response carries.
          Advisory: they never hide the job, never downrank it, and never move
          the coverage above — the server computes that from skills alone, and
          a work permit is not a skill. */}
      {requirements.unmet.length > 0 || requirements.met.length > 0 ? (
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: c.mutedForeground }]}>Requirements</Text>
          {requirements.unmet.map((b) => (
            <View key={`${b.category}-${b.reason}`} style={styles.requirement}>
              <AppSymbol
                name="exclamationmark.triangle.fill"
                size={13}
                tintColor={c[blockerTone(b.severity)]}
              />
              <Text style={[styles.requirementText, { color: c[blockerTone(b.severity)] }]}>
                {b.reason}
              </Text>
            </View>
          ))}
          {requirements.met.map((b) => (
            <View key={`${b.category}-${b.reason}`} style={styles.requirement}>
              <AppSymbol name="checkmark" size={13} tintColor={c.brand} />
              <Text style={[styles.requirementText, { color: c.mutedForeground }]}>{b.reason}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Space.lg,
    gap: Space.md,
  },
  heading: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  line: {
    fontSize: 13,
    lineHeight: 19,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  ctaText: {
    flex: 1,
  },
  cta: {
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  ctaLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  percent: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  counts: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  track: {
    flexDirection: 'row',
    height: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  group: {
    gap: 6,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipVia: {
    fontWeight: '400',
  },
  teaser: {
    gap: Space.sm,
    // The blur overlays this box, so it must clip to it — otherwise the effect
    // spills over the card's own rounded corner.
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  requirementText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});
