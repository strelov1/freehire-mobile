import { Pressable, StyleSheet, Text } from 'react-native';

import { getColors, Radius } from '@/constants/freehire';

/** A skill's three states: unselected, wanted (include), or avoided (exclude).
 *  Tapping cycles through them.
 *
 *  Shared by the Filters screen — where the cycle means "search for / search
 *  without / neither" — and the profile editor, where it means "I have this /
 *  I'd rather avoid it / neither". The same three answers about one skill, so
 *  the same chip: two copies would have to be kept looking alike by hand. */
export function SkillChip({
  label,
  count,
  state,
  colors,
  onPress,
}: {
  label: string;
  count?: number;
  state: 'off' | 'include' | 'exclude';
  colors: ReturnType<typeof getColors>;
  onPress: () => void;
}) {
  let stateStyle;
  let textColor;
  switch (state) {
    case 'include':
      stateStyle = { backgroundColor: colors.brandMuted, borderColor: colors.brand };
      textColor = colors.brandStrong;
      break;
    case 'exclude':
      stateStyle = { backgroundColor: colors.card, borderColor: colors.destructive };
      textColor = colors.destructive;
      break;
    default:
      stateStyle = { backgroundColor: colors.card, borderColor: colors.border };
      textColor = colors.foreground;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, stateStyle, pressed && { opacity: 0.7 }]}>
      <Text
        style={[
          styles.chipText,
          { color: textColor },
          state === 'exclude' && { textDecorationLine: 'line-through' },
        ]}>
        {label}
      </Text>
      {count != null ? (
        <Text style={[styles.chipCount, { color: state === 'off' ? colors.mutedForeground : textColor }]}>
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
