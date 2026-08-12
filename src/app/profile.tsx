import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/authStore';
import { getColors, Radius, Space } from '@/constants/freehire';
import { facetValueLabel, formatDate, profileLocationSummary } from '@/lib/format';
import { useProfile } from '@/lib/useProfile';

/** One row of chips (specializations or skills), reusing the identity
 *  section's badge style. Renders nothing for an empty list. */
function ChipRow({ c, values }: { c: ReturnType<typeof getColors>; values: string[] }) {
  if (!values.length) return null;
  return (
    <View style={styles.chipRow}>
      {values.map((v) => (
        <View key={v} style={[styles.badge, { backgroundColor: c.brandMuted }]}>
          <Text style={[styles.badgeText, { color: c.brandStrong }]}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The profile screen (modal) for a signed-in user: their identity, a
 * read-only view of their saved profile (specializations, skills, location),
 * and a sign-out button. Signing out clears the session and closes the modal
 * back to the feed.
 */
export default function ProfileScreen() {
  const c = getColors(useColorScheme());
  const { user, signOut } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    await signOut();
    router.back();
  }

  const joined = formatDate(user?.created_at);
  const locationLines = profile ? profileLocationSummary(profile.location_preferences) : [];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.foreground }]}>Profile</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <SymbolView name="xmark" size={20} weight="semibold" tintColor={c.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
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

        <View style={styles.profileSection}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>Profile</Text>
          {profileLoading ? (
            <ActivityIndicator color={c.mutedForeground} />
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
              No profile saved yet. Set one up at freehire.dev/my/profile.
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
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
  locationLine: {
    fontSize: 13,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.lg,
  },
  signOut: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
