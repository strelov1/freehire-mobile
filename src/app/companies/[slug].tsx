import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      <SymbolView name="chevron.left" size={22} weight="semibold" tintColor={color} />
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
      <View style={styles.topBar}>
        <BackButton color={c.foreground} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header: logo, name, tagline, badges. */}
        <View style={styles.header}>
          <CompanyLogo name={company.name} size={48} />
          <View style={styles.headerText}>
            <Text style={[styles.name, { color: c.foreground }]}>{company.name}</Text>
            {company.tagline ? (
              <Text style={[styles.tagline, { color: c.mutedForeground }]}>{company.tagline}</Text>
            ) : null}
          </View>
        </View>

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

        {info?.description ? (
          <Text style={[styles.description, { color: c.foreground }]}>{info.description}</Text>
        ) : null}

        {facts.length > 0 ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {facts.map((f) => (
              <FactRow key={f.label} label={f.label} values={f.values} color={c.mutedForeground} />
            ))}
          </View>
        ) : null}

        {rating ? (
          <View style={styles.iconRow}>
            <SymbolView name="star.fill" size={14} tintColor={c.foreground} />
            <Text style={[styles.rating, { color: c.foreground }]}>{rating}</Text>
          </View>
        ) : null}

        {/* Static thumbs counters — read-only in v1, no vote buttons. */}
        {company.upvote_count > 0 || company.downvote_count > 0 ? (
          <View style={styles.iconRow}>
            <SymbolView name="hand.thumbsup" size={14} tintColor={c.mutedForeground} />
            <Text style={[styles.votes, { color: c.mutedForeground }]}>{company.upvote_count}</Text>
            <SymbolView name="hand.thumbsdown" size={14} tintColor={c.mutedForeground} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  headerText: {
    flex: 1,
    gap: Space.xs,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
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
