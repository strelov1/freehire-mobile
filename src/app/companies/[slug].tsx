import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { CompanyLogo } from '@/components/CompanyLogo';
import { JobCard } from '@/components/JobCard';
import { getColors, Radius, Space } from '@/constants/freehire';
import { companyFacts, companyRating } from '@/lib/format';
import { useCompany } from '@/lib/useCompany';

/** A compact back affordance — just a chevron, no label or bar. Pops the stack,
 *  or falls back to the feed when the screen was opened cold (e.g. a deep link
 *  with no history to go back to). Mirrors `jobs/[slug].tsx`'s BackButton. */
function BackButton({ color }: { color: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}>
      <AppSymbol name="chevron.left" size={22} weight="semibold" tintColor={color} />
    </Pressable>
  );
}

/** A single "label: values" row in the facts section, mirroring the JD
 *  screen's facet rows (same comma-joined-values convention). */
function FactRow({ label, values, color }: { label: string; values: string[]; color: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={[styles.factLabel, { color }]}>{label}</Text>
      <Text style={[styles.factValue, { color }]}>{values.join(', ')}</Text>
    </View>
  );
}

/** How much of the description shows before it has to be asked for. Three, as
 *  the web clamps it. */
const COLLAPSED_LINES = 3;

/**
 * The company's own summary, collapsed to a few lines and expandable — the port
 * of the web's CompanyAbout. Some of these run to a dozen paragraphs and pushed
 * the open roles, which is what the visit is for, off the bottom of the screen.
 *
 * The toggle appears only when the text ACTUALLY overflows. The web measures
 * that (scrollHeight against the clamped clientHeight); React Native has no such
 * pair, so the same answer comes from laying the full text out once, invisibly
 * and outside the flow, and counting the lines it wanted. Guessing from the
 * character count would put a "Show more" under a summary with nothing more to
 * show.
 */
function About({ text, colors: c }: { text: string; colors: ReturnType<typeof getColors> }) {
  const [lines, setLines] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const clampable = (lines ?? 0) > COLLAPSED_LINES;

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.aboutLabel, { color: c.mutedForeground }]}>About</Text>
      <Text
        numberOfLines={expanded ? undefined : COLLAPSED_LINES}
        style={[styles.description, { color: c.foreground }]}>
        {text}
      </Text>
      {/* The measurer: same text, same type styles, no clamp, no space taken and
          nothing to see. Rendered until it has answered, then dropped. */}
      {lines === null ? (
        <Text
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onTextLayout={(e) => setLines(e.nativeEvent.lines.length)}
          style={[styles.description, styles.measure]}>
          {text}
        </Text>
      ) : null}
      {clampable ? (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
          <Text style={[styles.link, { color: c.brandStrong }]}>
            {expanded ? 'Show less' : 'Show more'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One outbound link (website / LinkedIn / YC profile), opened in the in-app
 *  browser like the JD screen's "Show →" CTA. */
function LinkRow({ label, url, color }: { label: string; url: string; color: string }) {
  return (
    <Pressable onPress={() => WebBrowser.openBrowserAsync(url)} hitSlop={8}>
      <Text style={[styles.link, { color }]}>{label} →</Text>
    </Pressable>
  );
}

/**
 * The company screen — the mobile port of the web's CompanyView, reached by
 * tapping a company name on the feed or a job's detail screen. Read-only: no
 * voting or feedback submission, only display of what the company-detail
 * endpoint returns, plus the company's own job list underneath.
 */
export default function CompanyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const c = getColors(useColorScheme());
  const { data, isLoading, isError, error, refetch } = useCompany(slug);
  const company = data?.company;
  const info = company?.company_info;

  if (isLoading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
        <View style={styles.topBar}>
          <BackButton color={c.foreground} />
        </View>
        <View style={[styles.fill, styles.center]}>
          <ActivityIndicator color={c.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !company) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
        <View style={styles.topBar}>
          <BackButton color={c.foreground} />
        </View>
        <View style={[styles.fill, styles.center]}>
          <Text style={[styles.errorText, { color: c.mutedForeground }]}>
            Couldn’t load this company.{'\n'}
            {(error as Error)?.message ?? 'Please try again.'}
          </Text>
          <Text onPress={() => refetch()} style={[styles.retry, { color: c.brand }]}>
            Tap to retry
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const facts = companyFacts(company);
  const rating = companyRating(company);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
      {/* The company rail sits inline with the back chevron, the shape the job
          screen uses for the same pair. A 48px logo over its own name cost a
          fifth of the screen to say what the row below already says, and pushed
          the roles — the reason for the visit — under the fold. */}
      <View style={styles.topBar}>
        <BackButton color={c.foreground} />
        <CompanyLogo name={company.name} size={32} />
        <Text numberOfLines={1} style={[styles.name, { color: c.foreground }]}>
          {company.name}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {company.tagline ? (
          <Text style={[styles.tagline, { color: c.mutedForeground }]}>{company.tagline}</Text>
        ) : null}

        {(info?.top_company || info?.is_hiring) && (
          <View style={styles.badgeRow}>
            {info.top_company ? (
              <View style={[styles.badge, { backgroundColor: c.brandMuted }]}>
                <Text style={[styles.badgeText, { color: c.brandStrong }]}>Top company</Text>
              </View>
            ) : null}
            {info.is_hiring ? (
              <View style={[styles.badge, { backgroundColor: c.brandMuted }]}>
                <Text style={[styles.badgeText, { color: c.brandStrong }]}>Actively hiring</Text>
              </View>
            ) : null}
          </View>
        )}

        {info?.description ? <About text={info.description} colors={c} /> : null}

        {facts.length > 0 ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {facts.map((f) => (
              <FactRow key={f.label} label={f.label} values={f.values} color={c.mutedForeground} />
            ))}
          </View>
        ) : null}

        {rating ? (
          <View style={styles.iconRow}>
            <AppSymbol name="star.fill" size={14} tintColor={c.foreground} />
            <Text style={[styles.rating, { color: c.foreground }]}>{rating}</Text>
          </View>
        ) : null}

        {/* Static thumbs counters — read-only in v1, no vote buttons. */}
        {company.upvote_count > 0 || company.downvote_count > 0 ? (
          <View style={styles.iconRow}>
            <AppSymbol name="hand.thumbsup" size={14} tintColor={c.mutedForeground} />
            <Text style={[styles.votes, { color: c.mutedForeground }]}>{company.upvote_count}</Text>
            <AppSymbol name="hand.thumbsdown" size={14} tintColor={c.mutedForeground} />
            <Text style={[styles.votes, { color: c.mutedForeground }]}>{company.downvote_count}</Text>
          </View>
        ) : null}

        {(info?.website || info?.homepage || info?.linkedin || info?.yc_url) && (
          <View style={styles.linkRow}>
            {info.website ? <LinkRow label="Website" url={info.website} color={c.brand} /> : null}
            {!info.website && info.homepage ? (
              <LinkRow label="Website" url={info.homepage} color={c.brand} />
            ) : null}
            {info.linkedin ? <LinkRow label="LinkedIn" url={info.linkedin} color={c.brand} /> : null}
            {info.yc_url ? <LinkRow label="YC profile" url={info.yc_url} color={c.brand} /> : null}
          </View>
        )}

        {data.jobs.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>
              Open roles ({data.jobs.length})
            </Text>
            <View style={styles.jobs}>
              {data.jobs.map((job) => (
                <JobCard key={job.public_slug} job={job} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Space.md },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.xl,
    gap: Space.md,
  },
  name: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tagline: {
    fontSize: 14,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
  aboutLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  /** Out of the flow and invisible: it exists only to be measured. */
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Space.lg,
    gap: Space.sm,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  factLabel: {
    fontSize: 13,
  },
  factValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '500',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rating: {
    fontSize: 14,
    fontWeight: '500',
  },
  votes: {
    fontSize: 13,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.lg,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    gap: Space.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  jobs: {
    gap: Space.md,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: Space.xl,
  },
  retry: {
    fontSize: 15,
    fontWeight: '600',
  },
});
