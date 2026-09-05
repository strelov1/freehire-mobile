import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { memo, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AppSymbol } from '@/components/AppSymbol';
import { CompanyLogo } from '@/components/CompanyLogo';
import { getColors, Radius, Space } from '@/constants/freehire';
import { useAuth } from '@/lib/authStore';
import { useDismissedJobs } from '@/lib/useDismissedJobs';
import { blurb, cardTags, formatSalary, timeAgo } from '@/lib/format';
import { computeClientMatch, matchTeaser } from '@/lib/jobMatch';
import type { Job } from '@/lib/types';
import { useProfile } from '@/lib/useProfile';
import { useSavedJobs } from '@/lib/useSavedJobs';

const MAX_SKILLS = 5;
// Wide enough for one icon at a comfortable touch size — a deliberate swipe
// (not an accidental scroll-drag) is needed to cross it, matching the width
// of the revealed action panel so the row never "half opens".
const SWIPE_THRESHOLD = 88;

/** One swipe-revealed action — a neutral panel with only the icon carrying
 *  color, not a full-bleed fill. Used for both the save and hide panels,
 *  which differ only in tint, icon, label, and handler. */
function SwipeAction({
  tint,
  background,
  icon,
  label,
  onPress,
}: {
  tint: string;
  background: string;
  icon: SFSymbol | string;
  label: string;
  onPress: () => void;
}) {
  return (
    <View style={[styles.actionPanel, { backgroundColor: background }]}>
      <Pressable
        onPress={onPress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <AppSymbol name={icon} size={22} tintColor={tint} />
      </Pressable>
    </View>
  );
}

/**
 * Wraps a strip of the card in the teaser's blur, or renders it plainly.
 *
 * Two of these rather than one around both, because the salary sits between the
 * chips and the strip in the layout and must stay legible — blurring the whole
 * tail would put the pay behind the invitation.
 *
 * Blurred, it is hidden from assistive technology and replaced by an invitation:
 * a screen reader read "87% match" would be told a figure about the user that
 * nobody computed, the blur that marks it as a tease existing only on screen.
 */
function Teased({
  blurred,
  scheme,
  style,
  children,
}: {
  blurred: boolean;
  scheme: string | null | undefined;
  style: object;
  children: React.ReactNode;
}) {
  if (!blurred) return <View style={style}>{children}</View>;

  return (
    <View
      accessible
      accessibilityLabel="Sign in to see how this job matches your skills"
      importantForAccessibility="yes"
      style={[style, styles.teased]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style}>
        {children}
      </View>
      <BlurView
        intensity={10}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * Single source of truth for how a job appears in the feed — the mobile port of
 * the web's JobRow. The whole card is pressable: tapping pushes the job-detail
 * screen (`/jobs/[slug]`), where the "Show" CTA opens the original posting.
 * Layout follows the design's reading order: company rail → title hero → facet
 * chips → blurb → skills + salary.
 *
 * Wrapped in `memo` because the feed re-renders on every page append; a card only
 * needs to re-render when its `job` identity changes.
 */
export const JobCard = memo(function JobCard({ job }: { job: Job }) {
  const scheme = useColorScheme();
  const c = getColors(scheme);
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { isSaved, toggle: toggleSaved } = useSavedJobs();
  const { hide } = useDismissedJobs();
  const swipeRef = useRef<SwipeableMethods>(null);
  const saved = isSaved(job.public_slug);

  // Derived display strings — memoized so scrolling doesn't re-run the HTML strip.
  const posted = useMemo(() => timeAgo(job.posted_at), [job.posted_at]);
  const tags = useMemo(() => cardTags(job), [job]);
  const text = useMemo(() => blurb(job), [job]);
  const salary = useMemo(() => formatSalary(job.enrichment), [job.enrichment]);
  const skills = job.skills ?? [];
  const shownSkills = skills.slice(0, MAX_SKILLS);
  const extraSkills = skills.length - MAX_SKILLS;

  // A real match needs a signed-in viewer with a non-empty profile skill list
  // AND a job that actually lists skills — anything short of that (signed
  // out, profile still loading/empty, a skill-less job) falls back to the
  // card's existing neutral chip styling and no match bar, per this change's
  // job-card-profile-match spec.
  const profileSkills = profile?.skills ?? [];
  const hasRealMatch = !!user && profileSkills.length > 0 && skills.length > 0;
  const real = hasRealMatch ? computeClientMatch(skills, profileSkills) : null;
  const haveSet = hasRealMatch ? new Set(profileSkills.map((s) => s.toLowerCase())) : null;

  // A locked viewer — signed out, or signed in with no profile skills — is shown
  // the teaser instead: plausible figures over this job's own skills, blurred,
  // as an invitation rather than an estimate. Seeded from the slug, so the score
  // cannot re-roll as the list remounts the card under a scrolling thumb. A job
  // with fewer than two skills yields none and keeps the plain card.
  const teaser = hasRealMatch ? null : matchTeaser(job.public_slug, skills);
  const match = real ?? teaser;

  /** Whether a chip reads as not-held. Null means "no opinion" — the neutral
   *  tint a job with too few skills to tease still gets. Both the chips and the
   *  bar are fed from the same match, so the tints and the percentage cannot
   *  disagree. */
  const isMissing = (skill: string): boolean | null => {
    if (haveSet) return !haveSet.has(skill.toLowerCase());
    if (teaser) return teaser.missing.has(skill);
    return null;
  };

  function open() {
    router.push(`/jobs/${job.public_slug}`);
  }

  // `direction` names which side's action panel opened (RNGH's own vocabulary:
  // `renderLeftActions`/swiping the row RIGHT → 'left'; `renderRightActions`/
  // swiping LEFT → 'right') — not the swipe direction itself. Fires the instant
  // a swipe crosses SWIPE_THRESHOLD and settles open, so a single continuous
  // swipe commits, matching "swipe right to hide, swipe left to save" as one
  // gesture rather than a reveal-then-tap two-step. The revealed action
  // button's own onPress calls this too (same handler), so a VoiceOver/Switch
  // Control activation of the button works identically.
  function commit(direction: 'left' | 'right') {
    if (!user) {
      router.push('/auth');
    } else if (direction === 'left') {
      hide(job.public_slug);
    } else {
      toggleSaved(job.public_slug, saved);
    }
    swipeRef.current?.close();
  }

  return (
    <Swipeable
      ref={swipeRef}
      leftThreshold={SWIPE_THRESHOLD}
      rightThreshold={SWIPE_THRESHOLD}
      onSwipeableOpen={commit}
      renderLeftActions={() => (
        <SwipeAction
          tint={c.destructive}
          background={c.card}
          icon="eye.slash.fill"
          label="Hide this job"
          onPress={() => commit('left')}
        />
      )}
      renderRightActions={() => (
        <SwipeAction
          tint={c.brandStrong}
          background={c.card}
          icon={saved ? 'bookmark.slash.fill' : 'bookmark.fill'}
          label={saved ? 'Remove bookmark' : 'Save job'}
          onPress={() => commit('right')}
        />
      )}>
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: c.card, borderColor: c.border },
          pressed && { backgroundColor: c.accent, borderColor: c.brand },
        ]}>
        {/* Company + timestamp rail — a quiet eyebrow that yields to the title. */}
        <View style={styles.headerRow}>
          <View style={styles.companyGroup}>
            <CompanyLogo name={job.company || '?'} size={28} />
            {job.company_slug ? (
              <Pressable
                onPress={() => router.push({ pathname: '/companies/[slug]', params: { slug: job.company_slug! } })}
                hitSlop={4}
                style={styles.companyTextWrap}>
                <Text numberOfLines={1} style={[styles.company, { color: c.mutedForeground }]}>
                  {job.company || 'Unknown company'}
                </Text>
              </Pressable>
            ) : (
              <Text numberOfLines={1} style={[styles.company, { color: c.mutedForeground }]}>
                {job.company || 'Unknown company'}
              </Text>
            )}
          </View>
          {posted ? (
            <Text style={[styles.posted, { color: c.mutedForeground }]}>{posted}</Text>
          ) : null}
        </View>

        {/* The title is the card's hero — a size up with tight leading. */}
        <Text numberOfLines={2} style={[styles.title, { color: c.foreground }]}>
          {job.title}
        </Text>

        {/* Signal row: quiet outline chips read as metadata, not decoration. */}
        {tags.length > 0 ? (
          <View style={styles.chipRow}>
            {tags.map((tag) => (
              <View key={tag} style={[styles.chip, { borderColor: c.border }]}>
                <Text style={[styles.chipText, { color: c.mutedForeground }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {text ? (
          <Text numberOfLines={2} style={[styles.blurb, { color: c.mutedForeground }]}>
            {text}
          </Text>
        ) : null}

        {/* Tail: skill badges (held/missing tinted against the viewer's profile
            for a real match, against the teaser for a locked one, else the plain
            brand tint) on the left, salary anchored right. The salary sits
            OUTSIDE the blur: the teaser is an invitation, not a paywall over the
            job. */}
        {(shownSkills.length > 0 || salary) && (
          <View style={styles.tailRow}>
            <Teased blurred={!!teaser} scheme={scheme} style={styles.skills}>
              {shownSkills.map((skill) => {
                const missing = isMissing(skill) === true;
                return (
                  <View
                    key={skill}
                    style={[
                      styles.badge,
                      { backgroundColor: missing ? c.destructiveMuted : c.brandMuted },
                    ]}>
                    <Text style={[styles.badgeText, { color: missing ? c.destructive : c.brandStrong }]}>
                      {skill}
                    </Text>
                  </View>
                );
              })}
              {extraSkills > 0 ? (
                <Text style={[styles.extra, { color: c.mutedForeground }]}>
                  +{extraSkills} skills
                </Text>
              ) : null}
            </Teased>
            {salary ? (
              <Text style={[styles.salary, { color: c.foreground }]}>{salary}</Text>
            ) : null}
          </View>
        )}

        {/* Profile skill-match strip: a two-tone coverage bar (brand fill = held,
            destructive-muted track = missing) plus the "N% · matched/total"
            label. A real match for a viewer with a profile; the blurred teaser
            for a locked one. */}
        {match ? (
          <Teased blurred={!!teaser} scheme={scheme} style={styles.matchRow}>
            <View style={[styles.matchTrack, { backgroundColor: c.destructiveMuted }]}>
              <View style={[styles.matchFill, { backgroundColor: c.brand, width: `${match.percent}%` }]} />
            </View>
            <Text style={[styles.matchLabel, { color: c.mutedForeground }]}>
              {match.percent}% · {match.matched}/{match.total} skills
            </Text>
          </Teased>
        ) : null}
      </Pressable>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Space.lg,
    gap: Space.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  companyGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  companyTextWrap: {
    flexShrink: 1,
  },
  company: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  posted: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  blurb: {
    fontSize: 14,
    lineHeight: 20,
  },
  tailRow: {
    marginTop: Space.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  skills: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  extra: {
    fontSize: 12,
  },
  salary: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  matchRow: {
    marginTop: Space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  /** Clips the teaser's blur to the strip it covers, so it doesn't bleed over
   *  the card's own rounded corner or the salary beside it. */
  teased: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  matchTrack: {
    flex: 1,
    height: 6,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  matchFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  matchLabel: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  actionPanel: {
    width: SWIPE_THRESHOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
