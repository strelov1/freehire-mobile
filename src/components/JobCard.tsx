import { router } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { CompanyLogo } from '@/components/CompanyLogo';
import { SaveButton } from '@/components/SaveButton';
import { getColors, Radius, Space } from '@/constants/freehire';
import { blurb, cardTags, formatSalary, timeAgo } from '@/lib/format';
import type { Job } from '@/lib/types';

const MAX_SKILLS = 5;

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
  const c = getColors(useColorScheme());

  // Derived display strings — memoized so scrolling doesn't re-run the HTML strip.
  const posted = useMemo(() => timeAgo(job.posted_at), [job.posted_at]);
  const tags = useMemo(() => cardTags(job), [job]);
  const text = useMemo(() => blurb(job), [job]);
  const salary = useMemo(() => formatSalary(job.enrichment), [job.enrichment]);
  const skills = job.skills ?? [];
  const shownSkills = skills.slice(0, MAX_SKILLS);
  const extraSkills = skills.length - MAX_SKILLS;

  function open() {
    router.push(`/jobs/${job.public_slug}`);
  }

  return (
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
          <CompanyLogo name={job.company || '?'} size={40} />
          {job.company_slug ? (
            <Pressable
              onPress={() => router.push(`/companies/${job.company_slug}`)}
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
        <SaveButton slug={job.public_slug} size={20} />
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

      {/* Tail: brand-tinted skill badges on the left, salary anchored right. */}
      {(shownSkills.length > 0 || salary) && (
        <View style={styles.tailRow}>
          <View style={styles.skills}>
            {shownSkills.map((skill) => (
              <View
                key={skill}
                style={[styles.badge, { backgroundColor: c.brandMuted }]}>
                <Text style={[styles.badgeText, { color: c.brandStrong }]}>{skill}</Text>
              </View>
            ))}
            {extraSkills > 0 ? (
              <Text style={[styles.extra, { color: c.mutedForeground }]}>
                +{extraSkills} skills
              </Text>
            ) : null}
          </View>
          {salary ? (
            <Text style={[styles.salary, { color: c.foreground }]}>{salary}</Text>
          ) : null}
        </View>
      )}
    </Pressable>
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
});
