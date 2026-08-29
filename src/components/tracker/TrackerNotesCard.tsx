import { memo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';

import { getColors, Radius, Space } from '@/constants/freehire';

export type TrackerNotesCardProps = {
  notes: string;
  isDirty: boolean;
  isSaving: boolean;
  onChangeNotes: (text: string) => void;
  onSaveNotes: () => void;
};

export const TrackerNotesCard = memo(function TrackerNotesCard({
  notes,
  isDirty,
  isSaving,
  onChangeNotes,
  onSaveNotes,
}: TrackerNotesCardProps) {
  const c = getColors(useColorScheme());

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.notesHeader}>
        <Text style={[styles.cardSectionLabel, { color: c.mutedForeground }]}>Notes</Text>
        {isDirty ? (
          <Pressable
            onPress={onSaveNotes}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save notes"
            style={[styles.saveNotesBtn, { backgroundColor: c.brand }]}>
            <Text style={[styles.saveNotesBtnText, { color: c.brandForeground }]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <TextInput
        value={notes}
        onChangeText={onChangeNotes}
        placeholder="Add interview dates, contacts, or referral details…"
        placeholderTextColor={c.mutedForeground}
        multiline
        numberOfLines={4}
        style={[
          styles.notesInput,
          { color: c.foreground, borderColor: c.border, backgroundColor: c.muted },
        ]}
      />
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
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveNotesBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 4,
  },
  saveNotesBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Space.sm,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
