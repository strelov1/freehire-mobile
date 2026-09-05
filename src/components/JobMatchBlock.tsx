import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space, type FreehirePalette } from '@/constants/freehire';
import {
  blockerTone,
  claimSkill,
  matchBarSegments,
  matchHasGroups,
  matchTeaser,
  partitionBlockers,
  teaserChips,
  type MatchState,
  type MatchTeaser,
} from '@/lib/jobMatch';
import type { JobMatchResult } from '@/lib/types';
import { useSkillClaims } from '@/lib/useSkillClaims';

/** One skill chip. The three tones are the block's whole vocabulary: brand for a
 *  skill held outright, amber for one held only through a neighbour, red for one
 *  missing. `via` rides in the label as well as on screen so the "close" reading
 *  survives into a screen reader, where the colour does not.
 *
 *  A not-held chip is also a control: pressing it asks whether the viewer holds
 *  the skill after all, or would rather be shown less of it. Held chips stay
 *  inert — this affordance adds skills and never removes one. An avoided skill
 *  keeps its place in its group (the job still asks for it, and the score still
 *  counts it) but reads as struck through. */
function SkillChip({
  skill,
  via,
  tone,
  avoided,
  open,
  onPress,
  colors: c,
}: {
  skill: string;
  via?: string;
  tone: 'have' | 'close' | 'missing';
  avoided?: boolean;
  open?: boolean;
  onPress?: () => void;
  colors: FreehirePalette;
}) {
  const fill =
    tone === 'have' ? c.brandMuted : tone === 'close' ? c.warningMuted : c.destructiveMuted;
  const text = tone === 'have' ? c.brandStrong : tone === 'close' ? c.warningStrong : c.destructive;

  const label = [skill, via ? `close — you have ${via}` : null, avoided ? 'you avoid this skill' : null]
    .filter(Boolean)
    .join(', ');

  const body = (
    <Text
      style={[styles.chipText, { color: text }, avoided && styles.chipAvoided]}>
      {skill}
      {via ? <Text style={styles.chipVia}> · {via}</Text> : null}
    </Text>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={[styles.chip, { backgroundColor: fill }]}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: !!open }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: fill },
        open && { borderWidth: 1, borderColor: c.mutedForeground },
        pressed && { opacity: 0.7 },
      ]}>
      {body}
    </Pressable>
  );
}

/**
 * The row a not-held chip discloses. It NAMES the skill rather than asking "do
 * you have it?": that question fits one answer, and the row carries two.
 *
 * It expands under the group rather than floating over it — a phone-width column
 * has nowhere to anchor a popover, and naming the skill is what keeps the row
 * tied to the chip that opened it.
 */
function ClaimRow({
  skill,
  avoided,
  pending,
  onClaim,
  onAvoid,
  onUnavoid,
  colors: c,
}: {
  skill: string;
  avoided: boolean;
  pending: boolean;
  onClaim: () => void;
  onAvoid: () => void;
  onUnavoid: () => void;
  colors: FreehirePalette;
}) {
  return (
    <View style={styles.claimRow}>
      <Text style={[styles.claimSkill, { color: c.foreground }]}>{skill}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={onClaim}
        style={({ pressed }) => [
          styles.claimAction,
          { backgroundColor: c.brandMuted },
          pending && { opacity: 0.5 },
          pressed && { opacity: 0.7 },
        ]}>
        <Text style={[styles.claimActionText, { color: c.brandStrong }]}>I have it</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={avoided ? onUnavoid : onAvoid}
        style={({ pressed }) => [
          styles.claimAction,
          { borderWidth: 1, borderColor: c.border },
          pending && { opacity: 0.5 },
          pressed && { opacity: 0.7 },
        ]}>
        <Text style={[styles.claimActionText, { color: c.mutedForeground }]}>
          {avoided ? 'Stop avoiding' : 'Avoid'}
        </Text>
      </Pressable>
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
 * The screen owns `useJobMatch` — it needs the same answer to decide whether to
 * keep its own skill row — and hands the result down. What this block owns is
 * what to draw for it, and the one-skill writes its chips produce, which it
 * takes from `useSkillClaims` (the only hook it reads, and the only one a test
 * has to stand in for).
 *
 * Five states, exactly one of which shows a match. The locked ones — `guest` and
 * `no-profile` — show the blurred teaser above a way out, and their chips are
 * inert: claiming against figures nobody computed would be inviting a candidate
 * to correct a fiction.
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
  const claims = useSkillClaims();

  // Which chip's row is open, and the optimistic reading a confirmed claim
  // leaves behind until the server's own answer lands.
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<JobMatchResult | null>(null);

  // A refetched match arrives as a new object, and it is the server's own
  // classification — including a skill the claim newly made adjacent, which the
  // client could not know. Dropping the overlay when the fetched match changes
  // is what hands the block back to it. Adjusting state during render on a prop
  // change, rather than in an effect, so the block never paints the stale
  // optimistic figure over an answer it already has.
  const [reconciled, setReconciled] = useState(match);
  if (reconciled !== match) {
    setReconciled(match);
    if (overlay) setOverlay(null);
  }

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

  // The optimistic reading while a claim is unreconciled, the fetched match
  // otherwise. A refetch that lands clears the overlay by identity: the fetched
  // match is a new object, so an overlay built from the old one is stale.
  const view = overlay ?? match;
  const segments = matchBarSegments(view);
  const held = view.exact_count + view.adjacent_count;
  const requirements = partitionBlockers(view.blockers);

  /** Press a not-held chip: open its row, or close it if it is the open one. */
  const toggleRow = (skill: string) => setOpenSkill((open) => (open === skill ? null : skill));

  /** Confirm a claim. The skill moves and the coverage rises before the write
   *  settles, recomputed with the server's own weighting so the optimistic
   *  figure cannot drift from the answer that replaces it. A failed write puts
   *  the reading back exactly as it was. */
  async function confirmClaim(skill: string) {
    const before = view;
    setOverlay(claimSkill(before, skill));
    setOpenSkill(null);
    const ok = await claims.claim(skill);
    if (!ok) setOverlay(before === match ? null : before);
    // On success the overlay stays until the invalidated match refetches, at
    // which point `match` is a new object and the effect below drops it. A
    // failed refetch keeps the optimistic view: the server accepted the write,
    // so reverting would misreport the profile.
  }

  async function confirmAvoid(skill: string) {
    setOpenSkill(null);
    // Nothing optimistic to render: an avoided skill is still one the candidate
    // does not have, so the match must not move.
    await claims.avoid(skill);
  }

  async function confirmUnavoid(skill: string) {
    setOpenSkill(null);
    await claims.unavoid(skill);
  }

  const chipProps = (skill: string) => ({
    avoided: claims.avoided.has(skill.toLowerCase()),
    open: openSkill === skill,
    onPress: () => toggleRow(skill),
  });

  const row = (skills: string[]) =>
    openSkill && skills.includes(openSkill) ? (
      <ClaimRow
        skill={openSkill}
        avoided={claims.avoided.has(openSkill.toLowerCase())}
        pending={claims.pending}
        onClaim={() => confirmClaim(openSkill)}
        onAvoid={() => confirmAvoid(openSkill)}
        onUnavoid={() => confirmUnavoid(openSkill)}
        colors={c}
      />
    ) : null;

  return (
    <View style={card}>
      {heading}

      <View style={styles.percentRow}>
        <Text style={[styles.percent, { color: c.foreground }]}>{view.coverage_percent}%</Text>
        <Text style={[styles.counts, { color: c.mutedForeground }]}>
          {held} of {view.total} skills
        </Text>
      </View>

      {/* One label for the whole bar: two unlabelled views announced separately
          would be noise, and the figure is what the bar is for. */}
      <View
        accessible
        accessibilityLabel={`${view.coverage_percent}% match, ${held} of ${view.total} skills`}
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

      {/* Held chips are inert: this affordance adds skills, never removes one. */}
      {view.matched.length > 0 ? (
        <SkillGroup title="You have" colors={c}>
          {view.matched.map((skill) => (
            <SkillChip key={skill} skill={skill} tone="have" colors={c} />
          ))}
        </SkillGroup>
      ) : null}

      {view.adjacent.length > 0 ? (
        <SkillGroup title="Close" colors={c}>
          {view.adjacent.map((a) => (
            <SkillChip
              key={a.name}
              skill={a.name}
              via={a.via}
              tone="close"
              colors={c}
              {...chipProps(a.name)}
            />
          ))}
        </SkillGroup>
      ) : null}
      {/* The row for a Close chip offers to add the skill ITSELF, not the
          neighbour it was matched through. */}
      {row(view.adjacent.map((a) => a.name))}

      {view.missing.length > 0 ? (
        <SkillGroup title="Missing" colors={c}>
          {view.missing.map((skill) => (
            <SkillChip
              key={skill}
              skill={skill}
              tone="missing"
              colors={c}
              {...chipProps(skill)}
            />
          ))}
        </SkillGroup>
      ) : null}
      {row(view.missing)}

      {/* The last write, named and reversible. A further write replaces this,
          and undo subtracts only the skill it names — restoring a whole earlier
          profile would roll back anything claimed after it. */}
      {claims.last && !claims.failed ? (
        <View style={styles.ctaRow}>
          <Text style={[styles.line, styles.ctaText, { color: c.mutedForeground }]}>
            {claims.last.kind === 'claim'
              ? `Added ${claims.last.skill} to your profile.`
              : claims.last.kind === 'avoid'
                ? `Added ${claims.last.skill} to the skills you avoid.`
                : `${claims.last.skill} is no longer avoided.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={claims.pending}
            onPress={() => claims.undo()}
            style={({ pressed }) => [
              styles.claimAction,
              { borderWidth: 1, borderColor: c.border },
              pressed && { opacity: 0.7 },
            ]}>
            <Text style={[styles.claimActionText, { color: c.mutedForeground }]}>Undo</Text>
          </Pressable>
        </View>
      ) : null}

      {claims.failed ? (
        <Text style={[styles.line, { color: c.destructive }]}>
          Couldn’t update {claims.failed} in your profile. Try again.
        </Text>
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
  chipAvoided: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  claimSkill: {
    fontSize: 12,
    fontWeight: '600',
  },
  claimAction: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  claimActionText: {
    fontSize: 12,
    fontWeight: '600',
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
