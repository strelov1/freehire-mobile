import { memo } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space } from '@/constants/freehire';

export type TrackerSignalsCardProps = {
  silenceText: string | null;
  cvOpenedAgo: string | null;
  followedUpAgo: string | null;
  emailCount: number;
};

export const TrackerSignalsCard = memo(function TrackerSignalsCard({
  silenceText,
  cvOpenedAgo,
  followedUpAgo,
  emailCount,
}: TrackerSignalsCardProps) {
  const c = getColors(useColorScheme());

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.cardSectionLabel, { color: c.mutedForeground }]}>Signals & Activity</Text>

      <View style={styles.signalsList}>
        {silenceText ? (
          <View style={styles.signalItem}>
            <AppSymbol name="clock" size={16} tintColor={c.brandStrong} />
            <View style={styles.signalItemText}>
              <Text style={[styles.signalItemTitle, { color: c.foreground }]}>Silence status</Text>
              <Text style={[styles.signalItemSub, { color: c.brandStrong }]}>{silenceText}</Text>
            </View>
          </View>
        ) : null}

        {cvOpenedAgo ? (
          <View style={styles.signalItem}>
            <AppSymbol name="doc.text" size={16} tintColor={c.brandStrong} />
            <View style={styles.signalItemText}>
              <Text style={[styles.signalItemTitle, { color: c.foreground }]}>CV opened</Text>
              <Text style={[styles.signalItemSub, { color: c.mutedForeground }]}>
                Opened {cvOpenedAgo}
              </Text>
            </View>
          </View>
        ) : null}

        {followedUpAgo ? (
          <View style={styles.signalItem}>
            <AppSymbol name="arrow.uturn.right" size={16} tintColor={c.brandStrong} />
            <View style={styles.signalItemText}>
              <Text style={[styles.signalItemTitle, { color: c.foreground }]}>Followed up</Text>
              <Text style={[styles.signalItemSub, { color: c.mutedForeground }]}>
                Chased {followedUpAgo}
              </Text>
            </View>
          </View>
        ) : null}

        {emailCount > 0 ? (
          <View style={styles.signalItem}>
            <AppSymbol name="text.bubble" size={16} tintColor={c.brandStrong} />
            <View style={styles.signalItemText}>
              <Text style={[styles.signalItemTitle, { color: c.foreground }]}>Linked emails</Text>
              <Text style={[styles.signalItemSub, { color: c.mutedForeground }]}>
                {emailCount} {emailCount === 1 ? 'message' : 'messages'}
              </Text>
            </View>
          </View>
        ) : null}

        {!silenceText && !cvOpenedAgo && !followedUpAgo && emailCount === 0 ? (
          <Text style={[styles.noSignalsText, { color: c.mutedForeground }]}>
            No active signals recorded yet.
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.md,
    gap: Space.sm,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  signalsList: {
    gap: Space.sm,
    marginTop: Space.xs,
  },
  signalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  signalItemText: {
    flex: 1,
  },
  signalItemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  signalItemSub: {
    fontSize: 12,
  },
  noSignalsText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
