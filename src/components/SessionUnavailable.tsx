import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { getColors, Radius, Space } from '@/constants/freehire';

export function SessionUnavailable({
  onRetry,
  onDismiss,
  dismissText = 'Back to jobs',
}: {
  onRetry: () => void;
  onDismiss?: () => void;
  dismissText?: string;
}) {
  const colors = getColors(useColorScheme());

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>We couldn’t check your session.</Text>
      <Pressable onPress={() => void onRetry()} style={[styles.button, { backgroundColor: colors.brand }]}>
        <Text style={{ color: colors.brandForeground, fontWeight: '700' }}>Retry</Text>
      </Pressable>
      {onDismiss ? (
        <Pressable onPress={onDismiss}>
          <Text style={{ color: colors.brandStrong, fontWeight: '600' }}>{dismissText}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.md, padding: Space.xl },
  message: { textAlign: 'center', fontSize: 15 },
  button: { minWidth: 140, height: 46, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
});
