import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Radius, Space, getColors } from '@/constants/freehire';

export type ConfirmationModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string | null;
  confirmVariant?: 'primary' | 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'default',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const c = getColors(useColorScheme());

  const confirmBg =
    confirmVariant === 'danger'
      ? c.destructive
      : confirmVariant === 'primary'
        ? c.brand
        : c.muted;

  // Each fill has a token naming what reads on it — `danger` was the one
  // assuming white always would.
  const confirmTextColor =
    confirmVariant === 'danger'
      ? c.destructiveForeground
      : confirmVariant === 'primary'
        ? c.brandForeground
        : c.foreground;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: c.mutedForeground }]}>{message}</Text>
          ) : null}
          <View style={styles.actions}>
            {cancelText ? (
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
                style={({ pressed }) => [
                  styles.button,
                  styles.cancelButton,
                  { borderColor: c.border },
                  pressed && { opacity: 0.7 },
                ]}>
                <Text style={[styles.cancelText, { color: c.foreground }]}>{cancelText}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                { backgroundColor: confirmBg },
                pressed && { opacity: 0.8 },
              ]}>
              <Text style={[styles.confirmText, { color: confirmTextColor }]}>{confirmText}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    padding: Space.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Space.xs,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Space.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Space.sm,
    marginTop: Space.sm,
  },
  button: {
    paddingVertical: Space.sm + 2,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {},
  confirmText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
