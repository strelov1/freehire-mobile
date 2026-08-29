import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space } from '@/constants/freehire';
import { ACTIVE_STAGES, CLOSED_OUTCOMES, type TrackerStage } from '@/lib/tracker';

export type ApplicationStagePickerProps = {
  visible: boolean;
  currentStage: string | null;
  onSelectStage: (stage: TrackerStage) => void;
  onClose: () => void;
};

export function ApplicationStagePicker({
  visible,
  currentStage,
  onSelectStage,
  onClose,
}: ApplicationStagePickerProps) {
  const c = getColors(useColorScheme());

  function handleSelect(stage: TrackerStage) {
    onSelectStage(stage);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Text style={[styles.headerTitle, { color: c.foreground }]}>Update Stage</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close stage picker"
            hitSlop={10}
            style={styles.closeButton}>
            <AppSymbol name="xmark" size={20} tintColor={c.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.sectionTitle, { color: c.brandStrong }]}>Active Pipeline</Text>
          <View style={[styles.groupCard, { backgroundColor: c.card, borderColor: c.border }]}>
            {ACTIVE_STAGES.map((item, index) => {
              const isSelected = currentStage === item.stage;
              const isLast = index === ACTIVE_STAGES.length - 1;
              return (
                <Pressable
                  key={item.stage}
                  onPress={() => handleSelect(item.stage)}
                  accessibilityRole="button"
                  accessibilityState={isSelected ? { selected: true } : {}}
                  accessibilityLabel={`Select stage ${item.label}`}
                  style={({ pressed }) => [
                    styles.row,
                    !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.stageLabel, { color: c.foreground }]}>{item.label}</Text>
                  {isSelected ? (
                    <AppSymbol name="checkmark" size={18} tintColor={c.brandStrong} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: c.mutedForeground, marginTop: Space.lg }]}>
            Closed Outcomes
          </Text>
          <Text style={[styles.sectionSubtitle, { color: c.mutedForeground }]}>
            Select the exact outcome to close this application:
          </Text>
          <View style={[styles.groupCard, { backgroundColor: c.card, borderColor: c.border }]}>
            {CLOSED_OUTCOMES.map((item, index) => {
              const isSelected = currentStage === item.stage;
              const isLast = index === CLOSED_OUTCOMES.length - 1;
              return (
                <Pressable
                  key={item.stage}
                  onPress={() => handleSelect(item.stage)}
                  accessibilityRole="button"
                  accessibilityState={isSelected ? { selected: true } : {}}
                  accessibilityLabel={`Select closed outcome ${item.label}`}
                  style={({ pressed }) => [
                    styles.row,
                    !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.stageLabel, { color: c.foreground }]}>{item.label}</Text>
                  {isSelected ? (
                    <AppSymbol name="checkmark" size={18} tintColor={c.brandStrong} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: Space.xs,
  },
  content: {
    padding: Space.lg,
    gap: Space.xs,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Space.xs,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: Space.sm,
  },
  groupCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
  },
  stageLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
