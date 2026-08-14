import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { Radius, Space, getColors } from '@/constants/freehire';
import { useAuth } from '@/lib/authStore';
import { formatDate } from '@/lib/format';

const PRIVACY_POLICY_URL = 'https://freehire.me/privacy';
const TERMS_OF_SERVICE_URL = 'https://freehire.me/terms';

export default function AccountScreen() {
  const c = getColors(useColorScheme());
  const { user, state, signOut, logoutAll, retryBootstrap, recordReturnIntent } = useAuth();
  const [busy, setBusy] = useState<'signOut' | 'logoutAll' | null>(null);

  const handleOpenPrivacy = async () => {
    try {
      await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      });
    } catch {
      // quiet fallback
    }
  };

  const handleOpenTerms = async () => {
    try {
      await WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      });
    } catch {
      // quiet fallback
    }
  };

  const onSignOut = async () => {
    setBusy('signOut');
    try {
      await signOut();
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error)?.message ?? 'Could not sign out.');
    } finally {
      setBusy(null);
    }
  };

  const onLogoutAll = () => {
    Alert.alert(
      'Sign Out Everywhere?',
      'You will be signed out on this device and all other active mobile and web sessions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out Everywhere',
          style: 'destructive',
          onPress: async () => {
            setBusy('logoutAll');
            try {
              await logoutAll();
            } catch (err: unknown) {
              Alert.alert('Error', (err as Error)?.message ?? 'Could not sign out of all devices.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  if (state.status === 'unavailable') {
    return (
      <SafeAreaView edges={['top']} style={[styles.fill, styles.center, { backgroundColor: c.background }]}>
        <AppSymbol name="wifi.slash" size={48} tintColor={c.mutedForeground} />
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          Authentication service temporarily unavailable.
        </Text>
        <Pressable
          onPress={() => void retryBootstrap()}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: c.brand },
            pressed && { opacity: 0.85 },
          ]}>
          <Text style={[styles.primaryButtonText, { color: c.brandForeground }]}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView edges={['top']} style={[styles.fill, styles.center, { backgroundColor: c.background }]}>
        <AppSymbol name="person.crop.circle" size={56} tintColor={c.mutedForeground} />
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          Sign in to manage your account.
        </Text>
        <Pressable
          onPress={() => {
            recordReturnIntent({ kind: 'navigate', destination: 'account' });
            router.push('/auth');
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: c.brand },
            pressed && { opacity: 0.85 },
          ]}>
          <Text style={[styles.primaryButtonText, { color: c.brandForeground }]}>Sign in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const joined = formatDate(user.created_at);

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.background }]}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: c.border }]}>
        {router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <AppSymbol name="chevron.left" size={20} tintColor={c.foreground} />
            <Text style={[styles.backText, { color: c.foreground }]}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={[styles.headerTitle, { color: c.foreground }]}>Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Identity Card */}
        <View style={[styles.identityCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <AppSymbol name="person.crop.circle.fill" size={56} tintColor={c.brandStrong} />
          <Text style={[styles.email, { color: c.foreground }]} numberOfLines={1}>
            {user.email}
          </Text>
          <View style={styles.badges}>
            {user.role && user.role !== 'user' ? (
              <View style={[styles.badge, { backgroundColor: c.brandMuted }]}>
                <Text style={[styles.badgeText, { color: c.brandStrong }]}>{user.role}</Text>
              </View>
            ) : null}
            {user.beta_tester ? (
              <View style={[styles.badge, { backgroundColor: c.brandMuted }]}>
                <Text style={[styles.badgeText, { color: c.brandStrong }]}>beta</Text>
              </View>
            ) : null}
            {user.email_verified ? (
              <View style={[styles.badge, { backgroundColor: c.accent }]}>
                <Text style={[styles.badgeText, { color: c.foreground }]}>verified</Text>
              </View>
            ) : null}
          </View>
          {joined ? (
            <Text style={[styles.joined, { color: c.mutedForeground }]}>Joined {joined}</Text>
          ) : null}
        </View>

        {/* Security Navigation Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>Security</Text>
          <Pressable
            onPress={() => router.push('/account/security')}
            style={({ pressed }) => [
              styles.navCard,
              { backgroundColor: c.card, borderColor: c.border },
              pressed && { backgroundColor: c.accent },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Security Settings">
            <View style={styles.navCardContent}>
              <Text style={[styles.navCardTitle, { color: c.foreground }]}>Security Settings</Text>
              <Text style={[styles.navCardDescription, { color: c.mutedForeground }]}>
                Password, connected identities, and active sessions
              </Text>
            </View>
            <AppSymbol name="chevron.right" size={18} tintColor={c.mutedForeground} />
          </Pressable>
        </View>

        {/* Legal & Policies Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>Legal & Policies</Text>
          <View style={[styles.cardList, { borderColor: c.border, backgroundColor: c.card }]}>
            <Pressable
              onPress={handleOpenPrivacy}
              style={({ pressed }) => [
                styles.legalRow,
                { borderBottomWidth: 1, borderBottomColor: c.border },
                pressed && { backgroundColor: c.accent },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Privacy Policy">
              <View style={styles.legalInfo}>
                <Text style={[styles.legalTitle, { color: c.foreground }]}>Privacy Policy</Text>
                <Text style={[styles.legalUrl, { color: c.mutedForeground }]}>freehire.me/privacy</Text>
              </View>
              <AppSymbol name="arrow.up.right" size={16} tintColor={c.brandStrong} />
            </Pressable>

            <Pressable
              onPress={handleOpenTerms}
              style={({ pressed }) => [
                styles.legalRow,
                pressed && { backgroundColor: c.accent },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Terms of Service">
              <View style={styles.legalInfo}>
                <Text style={[styles.legalTitle, { color: c.foreground }]}>Terms of Service</Text>
                <Text style={[styles.legalUrl, { color: c.mutedForeground }]}>freehire.me/terms</Text>
              </View>
              <AppSymbol name="arrow.up.right" size={16} tintColor={c.brandStrong} />
            </Pressable>
          </View>
        </View>

        {/* Session Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>Session</Text>
          <View style={styles.sessionGroup}>
            <Pressable
              onPress={onSignOut}
              disabled={busy !== null}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: c.border, backgroundColor: c.card },
                pressed && { backgroundColor: c.accent },
                busy !== null && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sign out">
              {busy === 'signOut' ? (
                <ActivityIndicator color={c.foreground} />
              ) : (
                <Text style={[styles.actionButtonText, { color: c.foreground }]}>Sign out</Text>
              )}
            </Pressable>

            <Pressable
              onPress={onLogoutAll}
              disabled={busy !== null}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: c.border, backgroundColor: c.card },
                pressed && { backgroundColor: c.accent },
                busy !== null && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sign out of all devices">
              {busy === 'logoutAll' ? (
                <ActivityIndicator color={c.foreground} />
              ) : (
                <Text style={[styles.actionButtonText, { color: c.foreground }]}>
                  Sign out of all devices
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Danger Zone Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.destructive }]}>Danger Zone</Text>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.destructiveMuted }]}>
            <Text style={[styles.cardDescription, { color: c.mutedForeground }]}>
              Permanently delete your account and all associated personal data.
            </Text>
            <Pressable
              onPress={() => (router.push as (path: string) => void)('/account/delete')}
              style={({ pressed }) => [
                styles.deleteNavButton,
                { borderColor: c.destructive },
                pressed && { backgroundColor: c.destructiveMuted },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Delete Account">
              <Text style={[styles.deleteNavButtonText, { color: c.destructive }]}>Delete Account</Text>
              <AppSymbol name="chevron.right" size={16} tintColor={c.destructive} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.md,
    padding: Space.xl,
  },
  stateText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Space.xs,
    paddingHorizontal: Space.xs,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 60,
  },
  scrollContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    paddingBottom: Space.xl + 16,
    gap: Space.xl,
  },
  identityCard: {
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  email: {
    fontSize: 17,
    fontWeight: '600',
    maxWidth: '100%',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
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
  section: {
    gap: Space.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  navCardContent: {
    flex: 1,
    gap: 2,
    paddingRight: Space.md,
  },
  navCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  navCardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: Space.md,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardList: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  legalInfo: {
    gap: 2,
  },
  legalTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  legalUrl: {
    fontSize: 12,
  },
  sessionGroup: {
    gap: Space.sm,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.lg,
    height: 44,
  },
  deleteNavButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
