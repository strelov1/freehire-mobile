import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { CompanyLogo } from '@/components/CompanyLogo';
import { getColors, Radius, Space } from '@/constants/freehire';
import { timeAgo } from '@/lib/format';
import { formatSilence, groupOf, isPrunedJob, stageLabel } from '@/lib/tracker';
import type { TrackedJob } from '@/lib/types';

export type ApplicationCardProps = {
  item: TrackedJob;
  onPress: () => void;
};

export const ApplicationCard = memo(function ApplicationCard({
  item,
  onPress,
}: ApplicationCardProps) {
  const c = getColors(useColorScheme());
  const pruned = isPrunedJob(item);
  const companyName = item.job?.company || item.company_slug || 'Unknown company';
  const roleTitle = item.role_title || item.job?.title || 'Unknown role';
  const group = groupOf(item);
  const stageName = item.stage ? stageLabel(item.stage) : group === 'saved' ? 'Saved' : 'Applied';
  const silenceText = formatSilence(item.days_silent, item.silence_state);
  const hasNotes = Boolean(item.notes && item.notes.trim().length > 0);
  const followedUp = item.followed_up_at ? timeAgo(item.followed_up_at) : null;
  const cvOpened = item.cv_opened_at ? timeAgo(item.cv_opened_at) : null;

  // Accessible descriptive label
  const a11yParts = [
    roleTitle,
    companyName,
    `Stage: ${stageName}`,
    silenceText ? `Silence: ${silenceText}` : null,
    item.email_count > 0 ? `${item.email_count} linked emails` : null,
    hasNotes ? 'Has notes' : null,
    pruned ? 'Posting closed' : null,
  ].filter(Boolean);

  const isClosedStage = group === 'closed';
  const isSilent = item.silence_state === 'silent';
  const isUnconfirmed = item.silence_state === 'unconfirmed';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yParts.join(', ')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: c.border,
        },
        pressed && { opacity: 0.75 },
      ]}>
      <View style={styles.topRow}>
        <CompanyLogo name={companyName} size={36} />
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.title, { color: c.foreground }]}>
            {roleTitle}
          </Text>
          <Text numberOfLines={1} style={[styles.company, { color: c.mutedForeground }]}>
            {companyName}
            {pruned ? ' · Posting closed' : ''}
          </Text>
        </View>
        <View
          style={[
            styles.stageBadge,
            {
              backgroundColor: isClosedStage
                ? c.muted
                : group === 'saved'
                  ? c.border
                  : c.brandMuted,
              borderColor: isClosedStage ? c.border : c.brand,
            },
          ]}>
          <Text
            style={[
              styles.stageText,
              {
                color: isClosedStage
                  ? c.mutedForeground
                  : group === 'saved'
                    ? c.foreground
                    : c.brandStrong,
              },
            ]}>
            {stageName}
          </Text>
        </View>
      </View>

      {/* Signals & Metadata Bar */}
      <View style={styles.signalsRow}>
        {silenceText ? (
          <View
            style={[
              styles.signalPill,
              {
                backgroundColor: isSilent || isUnconfirmed ? c.brandMuted : c.muted,
              },
            ]}>
            <AppSymbol
              name="clock"
              size={12}
              tintColor={isSilent || isUnconfirmed ? c.brandStrong : c.mutedForeground}
            />
            <Text
              style={[
                styles.signalText,
                { color: isSilent || isUnconfirmed ? c.brandStrong : c.mutedForeground },
              ]}>
              {silenceText}
            </Text>
          </View>
        ) : null}

        {cvOpened ? (
          <View style={[styles.signalPill, { backgroundColor: c.muted }]}>
            <AppSymbol name="doc.text" size={12} tintColor={c.mutedForeground} />
            <Text style={[styles.signalText, { color: c.mutedForeground }]}>
              CV opened {cvOpened}
            </Text>
          </View>
        ) : null}

        {followedUp ? (
          <View style={[styles.signalPill, { backgroundColor: c.muted }]}>
            <AppSymbol name="arrow.uturn.right" size={12} tintColor={c.mutedForeground} />
            <Text style={[styles.signalText, { color: c.mutedForeground }]}>
              Chased {followedUp}
            </Text>
          </View>
        ) : null}

        {item.email_count > 0 ? (
          <View style={[styles.signalPill, { backgroundColor: c.muted }]}>
            <AppSymbol name="text.bubble" size={12} tintColor={c.mutedForeground} />
            <Text style={[styles.signalText, { color: c.mutedForeground }]}>
              {item.email_count} {item.email_count === 1 ? 'email' : 'emails'}
            </Text>
          </View>
        ) : null}

        {hasNotes ? (
          <View style={[styles.signalPill, { backgroundColor: c.muted }]}>
            <AppSymbol name="doc.text" size={12} tintColor={c.brandStrong} />
            <Text style={[styles.signalText, { color: c.brandStrong }]}>Notes</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.md,
    gap: Space.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  company: {
    fontSize: 13,
  },
  stageBadge: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.sm,
    paddingVertical: 3,
  },
  stageText: {
    fontSize: 11,
    fontWeight: '600',
  },
  signalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xs,
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.xs + 2,
    paddingVertical: 2,
  },
  signalText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
