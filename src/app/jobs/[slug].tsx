import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CompanyLogo } from '@/components/CompanyLogo';
import { JobDescription } from '@/components/JobDescription';
import { RealityBadge } from '@/components/RealityBadge';
import { SaveButton } from '@/components/SaveButton';
import { getColors, Radius, Space } from '@/constants/freehire';
import { formatDate, formatSalary, summaryFacets } from '@/lib/format';
import { useJob } from '@/lib/useJob';

/** A compact back affordance — just a chevron, no label or bar. Pops the stack,
 *  or falls back to the feed when the screen was opened cold (e.g. a deep link
 *  with no history to go back to). */
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

/**
 * The job-detail screen — a single-column port of the web's JobView (which
 * stacks to one column on mobile anyway). Reading order: company → title →
 * reality badge → Show CTA, then a metadata card (salary · skills · facets ·
 * source/posted/views), then the summary and full description. The auth-only web
 * features (Save, Report, JobMatch, apply-tracking) are omitted — this app has no
 * account.
 */
export default function JobDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const c = getColors(useColorScheme());
  const { data: job, isLoading, isError, error, refetch } = useJob(slug);

  const salary = useMemo(() => formatSalary(job?.enrichment), [job?.enrichment]);
  const facets = useMemo(() => (job ? summaryFacets(job) : []), [job]);
  const skills = job?.skills?.length ? job.skills : job?.enrichment?.skills ?? [];
  const posted = formatDate(job?.posted_at);
  const views = job?.view_count ?? 0;
  const applies = job?.applied_count ?? 0;

  // Initial load: a centered brand spinner rather than an empty flash.
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

  if (isError || !job) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
        <View style={styles.topBar}>
          <BackButton color={c.foreground} />
        </View>
        <View style={[styles.fill, styles.center]}>
          <Text style={[styles.errorText, { color: c.mutedForeground }]}>
            Couldn’t load this job.{'\n'}
            {(error as Error)?.message ?? 'Please try again.'}
          </Text>
          <Text onPress={() => refetch()} style={[styles.retry, { color: c.brand }]}>
            Tap to retry
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
      {/* Top bar: back chevron with the company rail inline beside it, so the
          logo + name sit level with the arrow instead of on their own row. */}
      <View style={styles.topBar}>
        <BackButton color={c.foreground} />
        <View style={styles.companyRow}>
          <CompanyLogo name={job.company || '?'} size={26} />
          <Text numberOfLines={1} style={[styles.company, { color: c.mutedForeground }]}>
            {job.company || 'Unknown company'}
          </Text>
        </View>
        <SaveButton slug={job.public_slug} size={24} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Title hero. */}
        <Text style={[styles.title, { color: c.foreground }]}>{job.title}</Text>

        {/* Trust signal — detailed here (evidence beside the chip). */}
        <RealityBadge reality={job.reality} postedAt={job.posted_at} detailed />

        {/* Closed banner — the position no longer accepts applications. */}
        {job.closed_at ? (
          <View style={[styles.banner, { backgroundColor: c.muted, borderColor: c.border }]}>
            <Text style={[styles.bannerText, { color: c.foreground }]}>
              This position is no longer accepting applications
              {formatDate(job.closed_at) ? ` (closed ${formatDate(job.closed_at)})` : ''}.
            </Text>
          </View>
        ) : null}

        {/* Metadata card — mirrors the web's sticky sidebar, stacked. */}
        {(salary || skills.length > 0 || facets.length > 0 || job.source || posted) && (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {salary ? (
              <Text style={[styles.salary, { color: c.foreground }]}>{salary}</Text>
            ) : null}

            {skills.length > 0 ? (
              <View style={styles.skills}>
                {skills.map((skill) => (
                  <View key={skill} style={[styles.badge, { backgroundColor: c.brandMuted }]}>
                    <Text style={[styles.badgeText, { color: c.brandStrong }]}>{skill}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {facets.length > 0 ? (
              <View style={[styles.facets, { borderTopColor: c.border }]}>
                {facets.map((f) => (
                  <View key={f.label} style={styles.facetRow}>
                    <Text style={[styles.facetLabel, { color: c.mutedForeground }]}>{f.label}</Text>
                    <Text style={[styles.facetValue, { color: c.foreground }]}>
                      {f.values.join(', ')}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Source · Posted · engagement — the quiet provenance line. */}
            <View style={[styles.meta, { borderTopColor: c.border }]}>
              <View style={styles.metaRow}>
                {job.source ? (
                  <View style={[styles.sourceChip, { borderColor: c.border }]}>
                    <Text style={[styles.sourceText, { color: c.mutedForeground }]}>{job.source}</Text>
                  </View>
                ) : null}
                {posted ? (
                  <Text style={[styles.metaText, { color: c.mutedForeground }]}>Posted {posted}</Text>
                ) : null}
              </View>
              {views > 0 || applies > 0 ? (
                <View style={styles.metaRow}>
                  {views > 0 ? (
                    <Text style={[styles.metaText, { color: c.mutedForeground }]}>
                      {views} {views === 1 ? 'view' : 'views'}
                    </Text>
                  ) : null}
                  {applies > 0 ? (
                    <Text style={[styles.metaText, { color: c.mutedForeground }]}>{applies} applied</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Model-written synopsis (enriched jobs only) — the headline above the body. */}
        {job.enrichment?.summary ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>Summary</Text>
            <Text style={[styles.summary, { color: c.mutedForeground }]}>{job.enrichment.summary}</Text>
          </View>
        ) : null}

        <JobDescription html={job.description} />
      </ScrollView>

      {/* Pinned primary CTA — anchored at the bottom so it's always reachable,
          and opens the original posting in an in-app browser. */}
      {job.url ? (
        <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(job.url as string)}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.brand },
              pressed && { opacity: 0.85 },
            ]}>
            <Text style={[styles.ctaText, { color: c.brandForeground }]}>Show →</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Space.md },
  topBar: {
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
  content: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.xl,
    gap: Space.md,
  },
  companyRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  company: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
  },
  cta: {
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
  },
  banner: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Space.lg,
    gap: Space.md,
  },
  salary: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  skills: {
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
  facets: {
    borderTopWidth: 1,
    paddingTop: Space.md,
    gap: Space.sm,
  },
  facetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  facetLabel: {
    fontSize: 13,
  },
  facetValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '500',
  },
  meta: {
    borderTopWidth: 1,
    paddingTop: Space.md,
    gap: Space.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.md,
  },
  sourceChip: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaText: {
    fontSize: 12,
  },
  section: {
    gap: Space.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  summary: {
    fontSize: 14,
    lineHeight: 21,
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
