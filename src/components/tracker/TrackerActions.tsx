import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space } from '@/constants/freehire';

export type TrackerActionsProps = {
  showMoveToSaved: boolean;
  isMovingToSaved: boolean;
  isRemoving: boolean;
  onMoveToSaved: () => void;
  onRemove: () => void;
};

export const TrackerActions = memo(function TrackerActions({
  showMoveToSaved,
  isMovingToSaved,
  isRemoving,
  onMoveToSaved,
  onRemove,
}: TrackerActionsProps) {
  const c = getColors(useColorScheme());

  return (
    <View style={styles.actionsSection}>
      {showMoveToSaved ? (
        <Pressable
          onPress={onMoveToSaved}
          disabled={isMovingToSaved}
          accessibilityRole="button"
          accessibilityLabel="Move to Saved list"
          style={({ pressed }) => [
            styles.secondaryActionBtn,
            { borderColor: c.border, backgroundColor: c.card },
            pressed && { opacity: 0.7 },
          ]}>
          <AppSymbol name="bookmark" size={16} tintColor={c.foreground} />
          <Text style={[styles.secondaryActionText, { color: c.foreground }]}>
            Move to Saved
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onRemove}
        disabled={isRemoving}
        accessibilityRole="button"
        accessibilityLabel="Remove from Tracker"
        style={({ pressed }) => [
          styles.removeButton,
          { borderColor: c.destructive, backgroundColor: c.destructiveMuted },
          pressed && { opacity: 0.7 },
        ]}>
        <AppSymbol name="trash" size={16} tintColor={c.destructive} />
        <Text style={[styles.removeButtonText, { color: c.destructive }]}>
          Remove from Tracker
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  actionsSection: {
    gap: Space.sm,
    marginTop: Space.sm,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Space.md,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Space.md,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
