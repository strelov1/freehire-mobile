import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/authStore';
import { getColors, Radius, Space } from '@/constants/freehire';
import { formatDate } from '@/lib/format';
import { usePushNotifications } from '@/lib/usePushNotifications';

/**
 * The account screen (modal) for a signed-in user: their email, a couple of
 * status badges, and a sign-out button. Signing out clears the session and
 * closes the modal back to the feed.
 */
export default function AccountScreen() {
  const c = getColors(useColorScheme());
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const push = usePushNotifications();
  // The outcome of the last test send. Kept separate from `push.error`: a test
  // that reports "no device registered" is a successful call with bad news, not
  // a failure, and the two read differently.
  const [testResult, setTestResult] = useState<string | null>(null);

  async function onSignOut() {
    setBusy(true);
    await signOut();
    router.back();
  }

  async function onTogglePush(next: boolean) {
    setTestResult(null);
    await (next ? push.enable() : push.disable());
  }

  async function onTestPush() {
    setTestResult(await push.sendTest());
  }

  const joined = formatDate(user?.created_at);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.foreground }]}>Account</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <SymbolView name="xmark" size={20} weight="semibold" tintColor={c.foreground} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.identity}>
          <SymbolView name="person.crop.circle.fill" size={56} tintColor={c.brandStrong} />
          <Text style={[styles.email, { color: c.foreground }]} numberOfLines={1}>
            {user?.email ?? 'Signed in'}
          </Text>
          <View style={styles.badges}>
            {user?.role && user.role !== 'user' ? (
              <View style={[styles.badge, { backgroundColor: c.brandMuted }]}>
                <Text style={[styles.badgeText, { color: c.brandStrong }]}>{user.role}</Text>
              </View>
            ) : null}
            {user?.beta_tester ? (
              <View style={[styles.badge, { backgroundColor: c.brandMuted }]}>
                <Text style={[styles.badgeText, { color: c.brandStrong }]}>beta</Text>
              </View>
            ) : null}
          </View>
          {joined ? (
            <Text style={[styles.joined, { color: c.mutedForeground }]}>Joined {joined}</Text>
          ) : null}
        </View>

        <View style={styles.settings}>
          <View style={[styles.settingRow, { borderColor: c.border, backgroundColor: c.card }]}>
            <View style={styles.settingText}>
              <Text style={[styles.settingLabel, { color: c.foreground }]}>Push notifications</Text>
              <Text style={[styles.settingHint, { color: c.mutedForeground }]}>
                Alerts from freehire on this device.
              </Text>
            </View>
            {push.busy ? (
              <ActivityIndicator color={c.mutedForeground} />
            ) : (
              <Switch
                value={push.enabled}
                onValueChange={onTogglePush}
                disabled={push.loading}
                trackColor={{ true: c.brand, false: c.border }}
              />
            )}
          </View>

          {push.enabled ? (
            <Pressable
              onPress={onTestPush}
              disabled={push.busy}
              hitSlop={8}
              style={({ pressed }) => pressed && { opacity: 0.5 }}>
              <Text style={[styles.testLink, { color: c.brandStrong }]}>Send test notification</Text>
            </Pressable>
          ) : null}

          {/* Error red matches the auth modal's — there is no palette token for it. */}
          {(push.error ?? testResult) ? (
            <Text
              style={[styles.settingNote, { color: push.error ? '#dc2626' : c.mutedForeground }]}>
              {push.error ?? testResult}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={onSignOut}
          disabled={busy}
          style={({ pressed }) => [
            styles.signOut,
            { borderColor: c.border, backgroundColor: c.card },
            pressed && { backgroundColor: c.accent },
          ]}>
          {busy ? (
            <ActivityIndicator color={c.mutedForeground} />
          ) : (
            <Text style={[styles.signOutText, { color: c.foreground }]}>Sign out</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  body: {
    flex: 1,
    paddingHorizontal: Space.lg,
    paddingTop: Space.xl,
    justifyContent: 'space-between',
  },
  identity: {
    alignItems: 'center',
    gap: Space.sm,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    maxWidth: '100%',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  joined: {
    fontSize: 13,
  },
  settings: {
    gap: Space.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  settingText: {
    flexShrink: 1,
    gap: 2,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingHint: {
    fontSize: 13,
  },
  testLink: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: Space.xs,
  },
  settingNote: {
    fontSize: 13,
    paddingHorizontal: Space.xs,
  },
  signOut: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.lg,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
