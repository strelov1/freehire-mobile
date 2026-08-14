import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { useAuth } from '@/lib/authStore';
import { getColors, Radius, Space } from '@/constants/freehire';
import { facetValueLabel, formatDate, profileLocationSummary } from '@/lib/format';
import { TAB_BAR_HEIGHT } from '@/lib/tabBarVisibility';
import { useProfile } from '@/lib/useProfile';

const PRIVACY_POLICY_URL = 'https://freehire.me/privacy';
const TERMS_OF_SERVICE_URL = 'https://freehire.me/terms';

/** One row of chips (specializations or skills), reusing the identity
 *  section's badge shape but without its `capitalize` transform: unlike the
 *  plain-word role/beta badges, these values (facet labels, raw skill
 *  tokens) already carry their intended casing — iOS's capitalize also
 *  lowercases the rest of each word, which would mangle a label like
 *  "DevOps" into "Devops". Renders nothing for an empty list. */
function ChipRow({ c, values }: { c: ReturnType<typeof getColors>; values: string[] }) {
  if (!values.length) return null;
  return (
    <View style={styles.chipRow}>
      {values.map((v) => (
        <View key={v} style={[styles.badge, { backgroundColor: c.brandMuted }]}>
          <Text style={[styles.badgeText, styles.chipText, { color: c.brandStrong }]}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The Profile tab: a signed-in user's identity, a read-only view of their
 * saved profile (specializations, skills, location), account deletion, and sign-out buttons.
 * Signed out, it shows an inline "Sign in" prompt instead of redirecting.
 */
export default function ProfileScreen() {
  const c = getColors(useColorScheme());
  const { user, state, signOut, logoutAll, recordReturnIntent, retryBootstrap } = useAuth();
  const { data: profile, isLoading: profileLoading, isError: profileError } = useProfile();
  const [busy, setBusy] = useState<'signOut' | 'logoutAll' | null>(null);

  async function onSignOut() {
    setBusy('signOut');
    try {
      await signOut();
    } finally {
      setBusy(null);
    }
  }

  async function onLogoutAll() {
    setBusy('logoutAll');
    try {
      await logoutAll();
    } finally {
      setBusy(null);
    }
  }

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

  if (state.status === 'unavailable') {
    return (
      <SafeAreaView edges={['top']} style={[styles.fill, styles.center, { backgroundColor: c.background }]}>
        <AppSymbol name="wifi.slash" size={48} tintColor={c.mutedForeground} />
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          Authentication service temporarily unavailable.
        </Text>
        <Pressable
          onPress={() => void retryBootstrap()}
          style={({ pressed }) => [
            styles.signIn,
            { backgroundColor: c.brand },
            pressed && { opacity: 0.85 },
          ]}>
          <Text style={[styles.signInText, { color: c.brandForeground }]}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView edges={['top']} style={[styles.fill, styles.center, { backgroundColor: c.background }]}>
        <AppSymbol name="person.crop.circle" size={56} tintColor={c.mutedForeground} />
        <Text style={[styles.stateText, { color: c.mutedForeground }]}>
          Sign in to see your profile.
        </Text>
        <Pressable
          onPress={() => {
            recordReturnIntent({ kind: 'navigate', destination: 'account' });
            router.push('/auth');
          }}
          style={({ pressed }) => [
            styles.signIn,
            { backgroundColor: c.brand },
            pressed && { opacity: 0.85 },
          ]}>
          <Text style={[styles.signInText, { color: c.brandForeground }]}>Sign in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const joined = formatDate(user.created_at);
  const locationLines = profile ? profileLocationSummary(profile.location_preferences) : [];

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.foreground }]}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.identity}>
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
          </View>
          {joined ? (
            <Text style={[styles.joined, { color: c.mutedForeground }]}>Joined {joined}</Text>
          ) : null}
        </View>

        <View style={styles.profileSection}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>Profile</Text>
          {profileLoading ? (
            <ActivityIndicator color={c.mutedForeground} />
          ) : profileError ? (
            <Text style={[styles.emptyText, { color: c.destructive }]}>{"Couldn't load your profile."}</Text>
          ) : profile ? (
            <View style={styles.profileBody}>
              <ChipRow c={c} values={profile.specializations.map((s) => facetValueLabel('category', s))} />
              <ChipRow c={c} values={profile.skills} />
              {locationLines.map((line) => (
                <Text key={line} style={[styles.locationLine, { color: c.mutedForeground }]}>
                  {line}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
              No profile saved yet. Set one up at freehire.me/my/profile.
            </Text>
          )}
        </View>

        {/* Legal & Policies Section */}
        <View style={styles.profileSection}>
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
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push('/account/security')}
          style={({ pressed }) => [
            styles.actionButton,
            { borderColor: c.border, backgroundColor: c.card },
            pressed && { backgroundColor: c.accent },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Security Settings">
          <Text style={[styles.actionButtonText, { color: c.foreground }]}>Security Settings</Text>
        </Pressable>

        <Pressable
          onPress={onSignOut}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.actionButton,
            { borderColor: c.border, backgroundColor: c.card },
            pressed && { backgroundColor: c.accent },
          ]}>
          {busy === 'signOut' ? (
            <ActivityIndicator color={c.mutedForeground} />
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
          ]}>
          {busy === 'logoutAll' ? (
            <ActivityIndicator color={c.mutedForeground} />
          ) : (
            <Text style={[styles.actionButtonText, { color: c.foreground }]}>Sign out of all devices</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => (router.push as (path: string) => void)('/account/delete')}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Delete Account">
          <Text style={[styles.deleteButtonText, { color: c.destructive }]}>Delete Account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: Space.md, padding: Space.xl },
  stateText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  signIn: {
    borderRadius: Radius.lg,
    paddingHorizontal: Space.xl,
    paddingVertical: 12,
  },
  signInText: {
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  body: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xl,
    paddingBottom: Space.xl,
    gap: Space.xl,
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
  profileSection: {
    gap: Space.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileBody: {
    gap: Space.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipText: {
    textTransform: 'none',
  },
  locationLine: {
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.lg + TAB_BAR_HEIGHT,
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
  deleteButton: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.xs,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
});
