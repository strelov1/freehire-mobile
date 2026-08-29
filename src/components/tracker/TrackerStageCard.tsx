import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space } from '@/constants/freehire';

export type TrackerStageCardProps = {
  currentStageLabel: string;
  appliedDate: string | null;
  eligibleForApply: boolean;
  isSavedGroup: boolean;
  isMarkingApplied: boolean;
  isUpdatingStage: boolean;
  onChangeStagePress: () => void;
  onMarkAppliedToday: () => void;
  onSetPreparing: () => void;
};

export const TrackerStageCard = memo(function TrackerStageCard({
  currentStageLabel,
  appliedDate,
  eligibleForApply,
  isSavedGroup,
  isMarkingApplied,
  isUpdatingStage,
  onChangeStagePress,
  onMarkAppliedToday,
  onSetPreparing,
}: TrackerStageCardProps) {
  const c = getColors(useColorScheme());

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.stageHeaderRow}>
        <View>
          <Text style={[styles.cardSectionLabel, { color: c.mutedForeground }]}>Current stage</Text>
          <Text style={[styles.stageValue, { color: c.foreground }]}>{currentStageLabel}</Text>
          {appliedDate ? (
            <Text style={[styles.appliedDateText, { color: c.mutedForeground }]}>
              Applied {appliedDate}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={onChangeStagePress}
          disabled={isUpdatingStage}
          accessibilityRole="button"
          accessibilityLabel="Change application stage"
          style={({ pressed }) => [
            styles.changeStageButton,
            { backgroundColor: c.muted, borderColor: c.border },
            pressed && { opacity: 0.7 },
          ]}>
          <Text style={[styles.changeStageText, { color: c.brandStrong }]}>Change stage</Text>
          <AppSymbol name="chevron.down" size={14} tintColor={c.brandStrong} />
        </Pressable>
      </View>

      {/* If Saved or eligible to mark applied, show explicit quick actions */}
      {eligibleForApply ? (
        <View style={[styles.quickActionsBox, { backgroundColor: c.muted, borderColor: c.border }]}>
          <Text style={[styles.quickActionsTitle, { color: c.foreground }]}>
            Ready to update?
          </Text>
          <Text style={[styles.quickActionsBody, { color: c.mutedForeground }]}>
            Mark this application applied only after you submitted your application.
          </Text>

          <View style={styles.applyActionButtons}>
            <Pressable
              onPress={onMarkAppliedToday}
              disabled={isMarkingApplied}
              accessibilityRole="button"
              accessibilityLabel="Mark as applied today"
              style={({ pressed }) => [
                styles.markAppliedBtn,
                { backgroundColor: c.brand },
                pressed && { opacity: 0.8 },
              ]}>
              <Text style={[styles.markAppliedText, { color: c.brandForeground }]}>
                {isMarkingApplied ? 'Marking...' : 'Mark as applied today'}
              </Text>
            </Pressable>

            {isSavedGroup ? (
              <Pressable
                onPress={onSetPreparing}
                disabled={isUpdatingStage}
                accessibilityRole="button"
                accessibilityLabel="Set stage to preparing"
                style={({ pressed }) => [
                  styles.setPreparingBtn,
                  { borderColor: c.border },
                  pressed && { opacity: 0.7 },
                ]}>
                <Text style={[styles.setPreparingText, { color: c.foreground }]}>
                  Or set Preparing
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
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
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stageValue: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  appliedDateText: {
    fontSize: 12,
    marginTop: 2,
  },
  changeStageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
  },
  changeStageText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickActionsBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Space.md,
    marginTop: Space.sm,
    gap: Space.xs,
  },
  quickActionsTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickActionsBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  applyActionButtons: {
    flexDirection: 'row',
    gap: Space.sm,
    marginTop: Space.xs,
    flexWrap: 'wrap',
  },
  markAppliedBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  markAppliedText: {
    fontSize: 13,
    fontWeight: '700',
  },
  setPreparingBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  setPreparingText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
