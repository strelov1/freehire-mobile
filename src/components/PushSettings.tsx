import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View, useColorScheme } from 'react-native';

import { getColors, Radius, Space } from '@/constants/freehire';
import { pushPlatform } from '@/lib/push';
import { usePushNotifications } from '@/lib/usePushNotifications';

/**
 * The Profile tab's push section: the switch that registers this device, and a
 * test send once it is on. It is the only way a device ever reaches the
 * backend, so every push channel the user picks on the web depends on it.
 * Renders nothing on web, where there is no push to register.
 */
export function PushSettings() {
  const c = getColors(useColorScheme());
  const push = usePushNotifications();
  // The outcome of the last test send. Kept apart from `push.error`: a test that
  // reports "no device registered" is a successful call with bad news, not a
  // failure, and the two read differently.
  const [testResult, setTestResult] = useState<string | null>(null);

  if (pushPlatform() === null) return null;

  async function onToggle(next: boolean) {
    setTestResult(null);
    await (next ? push.enable() : push.disable());
  }

  async function onTest() {
    setTestResult(await push.sendTest());
  }

  const note = push.error ?? testResult;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.foreground }]}>Notifications</Text>
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={[styles.title, { color: c.foreground }]}>Push notifications</Text>
            <Text style={[styles.detail, { color: c.mutedForeground }]}>
              Job alerts and reminders on this device.
            </Text>
          </View>
          {push.busy ? (
            <ActivityIndicator color={c.mutedForeground} />
          ) : (
            <Switch
              value={push.enabled}
              onValueChange={onToggle}
              disabled={push.loading}
              trackColor={{ true: c.brand, false: c.border }}
              accessibilityLabel="Push notifications"
            />
          )}
        </View>
      </View>

      {push.enabled ? (
        <Pressable
          onPress={onTest}
          disabled={push.busy}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <Text style={[styles.link, { color: c.brandStrong }]}>Send test notification</Text>
        </Pressable>
      ) : null}

      {note ? (
        <Text style={[styles.detail, { color: push.error ? c.destructive : c.mutedForeground }]}>{note}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Space.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    gap: Space.md,
  },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 13 },
  link: { fontSize: 14, fontWeight: '600' },
});
