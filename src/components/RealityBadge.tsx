import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { getColors, Radius, withAlpha } from '@/constants/freehire';
import { postingContrast, realityBadge } from '@/lib/reality';
import type { Reality } from '@/lib/types';

/**
 * The job-reality trust signal as a facts-backed chip. Renders nothing for a
 * fresh or unclassified job (realityBadge returns null). `detailed` appends the
 * complementary evidence — the posting-date contrast plus the copy/repost counts
 * — beside the chip, exactly as the web's detail view does.
 */
export function RealityBadge({
  reality,
  postedAt,
  detailed = false,
}: {
  reality?: Reality | null;
  postedAt?: string | null;
  detailed?: boolean;
}) {
  const c = getColors(useColorScheme());

  const badge = realityBadge(reality);
  if (!badge) return null;

  // The posting-contrast note first (when the source date reads fresher than the
  // true age), then the remaining evidence — joined the same way as the web.
  const detail =
    reality && detailed
      ? [postingContrast(reality, postedAt), badge.evidence].filter(Boolean).join(' · ')
      : '';

  // The warn chip is the design system's caution tone. It used to carry its own
  // amber literals, on the grounds that the palette had none — it does now, and
  // the palette also picks the readable tone per theme, which this had to branch
  // on `scheme` to do by hand.
  const warn = badge.tone === 'warn';
  const chipStyle = warn
    ? { borderColor: withAlpha(c.warning, 0.4), backgroundColor: c.warningMuted }
    : { borderColor: c.border, backgroundColor: 'transparent' };
  const textColor = warn ? c.warningStrong : c.mutedForeground;

  return (
    <View style={styles.row}>
      <View style={[styles.chip, chipStyle]}>
        <Text style={[styles.chipText, { color: textColor }]}>{badge.label}</Text>
      </View>
      {detail ? <Text style={[styles.detail, { color: c.mutedForeground }]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  detail: {
    fontSize: 12,
  },
});
