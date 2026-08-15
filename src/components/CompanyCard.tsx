import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { CompanyLogo } from '@/components/CompanyLogo';
import { getColors, Radius, Space } from '@/constants/freehire';
import type { CompanyListItem } from '@/lib/types';

/**
 * One row of the company directory — the mobile port of the web catalog's
 * company card, in this app's card language (`JobCard`'s border, radius and
 * outline chips) rather than the web's.
 *
 * Every field except the name and the open-role count is optional on the wire
 * and simply absent from the card when the API omits it; nothing renders a
 * placeholder. Wrapped in `memo` for the same reason `JobCard` is: the list
 * re-renders on every page append.
 */
export const CompanyCard = memo(function CompanyCard({ company }: { company: CompanyListItem }) {
  const c = getColors(useColorScheme());

  // The lead industry and the HQ country read the same way — one quiet fact
  // each — so they render as one chip row rather than two styled sites. The
  // country is an uppercased code, not a flag or a display name: the app has no
  // country dictionary and the JD screen already prints codes for this data.
  const chips = [company.industries?.[0], company.hq_country?.toUpperCase()].filter(
    (chip): chip is string => !!chip,
  );
  const rating = company.feedback_rating_avg;
  const jobs = `${company.job_count.toLocaleString('en-US')} ${company.job_count === 1 ? 'job' : 'jobs'}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${company.name}, ${jobs}`}
      onPress={() => router.push({ pathname: '/companies/[slug]', params: { slug: company.slug } })}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.card, borderColor: c.border },
        pressed && { backgroundColor: c.accent, borderColor: c.brand },
      ]}>
      <CompanyLogo name={company.name} size={40} />

      <View style={styles.body}>
        {/* Name yields space to the meta group, which never wraps: the rating
            and role count are the row's scannable numbers. */}
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.name, { color: c.foreground }]}>
            {company.name}
          </Text>
          <View style={styles.meta}>
            {rating != null ? (
              <View style={styles.rating}>
                <AppSymbol name="star.fill" size={12} tintColor={c.brandStrong} />
                <Text style={[styles.ratingText, { color: c.brandStrong }]}>
                  {rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.jobs, { color: c.mutedForeground }]}>{jobs}</Text>
          </View>
        </View>

        {company.tagline ? (
          <Text numberOfLines={1} style={[styles.tagline, { color: c.mutedForeground }]}>
            {company.tagline}
          </Text>
        ) : null}

        {chips.length > 0 ? (
          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <View key={chip} style={[styles.chip, { borderColor: c.border }]}>
                <Text style={[styles.chipText, { color: c.mutedForeground }]}>{chip}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Space.lg,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  meta: {
    marginLeft: 'auto',
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  jobs: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  tagline: {
    fontSize: 14,
    lineHeight: 19,
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
});
