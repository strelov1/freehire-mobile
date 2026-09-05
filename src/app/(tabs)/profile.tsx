import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { facetValueLabel, formatDate } from '@/lib/format';
import { planHeadline, planView } from '@/features/billing/model/planView';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/features/billing/storeLinks';
import { TAB_BAR_HEIGHT } from '@/lib/tabBarVisibility';
import { usePlan } from '@/lib/usePlan';
import { useProfile } from '@/lib/useProfile';



/**
 * The Profile tab: a signed-in user's identity, their saved profile
 * (specializations and skills, with a way into the editor), the plan, account
 * deletion, and sign-out buttons. Signed out, it shows an inline "Sign in"
 * prompt instead of redirecting.
 */
export default function ProfileScreen() {
  const c = getColors(useColorScheme());
  const { user, state, signOut, logoutAll, recordReturnIntent, retryBootstrap } = useAuth();
  const { data: plan, isError: planError } = usePlan();
  const { data: profile, isPending: profilePending } = useProfile();
  const [busy, setBusy] = useState<'signOut' | 'logoutAll' | null>(null);

  // The row states the plan or states that it could not be read — never a guess. Saying
  // "Free" over a failed request would be wrong in the one direction that matters: it invites
  // somebody who is already paying to buy the same plan again.
  const planCard = planHeadline(planView({ plan, canPurchase: false, failed: planError }));

  // A guest opening this tab wants to sign in, so hand them the sheet rather
  // than a screen whose only content is a button that opens it. Once per
  // signed-out spell, not once per focus: the sheet closing returns focus here,
  // and reopening on that would trap them behind a sheet they just dismissed.
  // The inline prompt below stays as the way back in.
  const promptedRef = useRef(false);
  useEffect(() => {
    if (user || state.status === 'bootstrapping' || state.status === 'unavailable') {
      promptedRef.current = false;
      return;
    }
    if (promptedRef.current) return;
    promptedRef.current = true;
    recordReturnIntent({ kind: 'navigate', destination: 'account' });
    router.push('/auth');
  }, [user, state.status, recordReturnIntent]);

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

        {/* The saved profile: what the match on every job is computed against,
            and the one thing here the user can change. */}
        <View style={styles.profileSection}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>Your profile</Text>
          <View style={[styles.cardList, { borderColor: c.border, backgroundColor: c.card }]}>
            <Pressable
              onPress={() => router.push('/account/profile')}
              style={({ pressed }) => [styles.settingRow, pressed && { backgroundColor: c.accent }]}
              accessibilityRole="button"
              accessibilityLabel={profile ? 'Edit your profile' : 'Set up your profile'}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: c.foreground }]}>
                  {profile ? 'Edit specializations and skills' : 'Set up your profile'}
                </Text>
                <Text style={[styles.settingDetail, { color: c.mutedForeground }]}>
                  {profilePending
                    ? 'Loading…'
                    : profile
                      ? `${profile.specializations.length} specializations · ${profile.skills.length} skills`
                      : 'Add skills to see how each job matches you'}
                </Text>
              </View>
              <AppSymbol name="chevron.right" size={16} tintColor={c.brandStrong} />
            </Pressable>
          </View>
          {profile ? (
            <View style={styles.profileBody}>
              <View style={styles.chipRow}>
                {profile.specializations.map((value) => (
                  <View key={value} style={[styles.badge, { backgroundColor: c.brandMuted }]}>
                    <Text style={[styles.badgeText, styles.chipText, { color: c.brandStrong }]}>
                      {facetValueLabel('category', value)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.chipRow}>
                {profile.skills.map((skill) => (
                  <View key={skill} style={[styles.badge, { backgroundColor: c.muted }]}>
                    <Text style={[styles.badgeText, styles.chipText, { color: c.foreground }]}>
                      {skill}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Plan. Information you tap into rather than an action on the session, so it sits
            with the other readable sections and not among Sign out and Delete Account. */}
        <View style={styles.profileSection}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>Plan</Text>
          <View style={[styles.cardList, { borderColor: c.border, backgroundColor: c.card }]}>
            <Pressable
              onPress={() => router.push('/account/plan')}
              style={({ pressed }) => [styles.settingRow, pressed && { backgroundColor: c.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Plan">
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: c.foreground }]}>{planCard.title}</Text>
                <Text style={[styles.settingDetail, { color: c.mutedForeground }]}>{planCard.detail}</Text>
              </View>
              <AppSymbol name="chevron.right" size={16} tintColor={c.brandStrong} />
            </Pressable>
          </View>
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

        {/* Inside the scroll, not pinned below it. A fixed block has to fit whatever is left
            after the content, and when it does not the last thing in it — Delete Account —
            simply disappears under the tab bar, silently and only on shorter screens. */}
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
      </ScrollView>
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
    // The tab bar floats over the scroll, so the clearance belongs to the scrolling content:
    // whatever ends up last has to be reachable, and what ends up last changes with the
    // account's state.
    paddingBottom: Space.xl + TAB_BAR_HEIGHT,
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
  // No longer pinned, so it carries no tab-bar clearance of its own — `body` owns that now.
  footer: {
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
  // The plan row wears the same shape as the legal rows without borrowing their names: a plan
  // title is not a legal title, and a plan's expiry is not a URL.
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    gap: Space.md,
  },
  settingInfo: { flex: 1, gap: 2 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingDetail: { fontSize: 13 },
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
