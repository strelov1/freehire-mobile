import { Pressable, StyleSheet, Text } from 'react-native';

import { getColors, Radius } from '@/constants/freehire';

/** A pill-shaped facet-value toggle, shared by the Filters screens. */
export function Chip({
  label,
  count,
  selected,
  colors,
  onPress,
}: {
  label: string;
  count?: number;
  selected: boolean;
  colors: ReturnType<typeof getColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: colors.brandMuted, borderColor: colors.brand }
          : { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}>
      <Text
        style={[styles.chipText, { color: selected ? colors.brandStrong : colors.foreground }]}>
        {label}
      </Text>
      {count != null ? (
        <Text style={[styles.chipCount, { color: selected ? colors.brandStrong : colors.mutedForeground }]}>
          {count.toLocaleString('en-US')}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipCount: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
