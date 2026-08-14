import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { ProviderIcon } from '@/components/ProviderIcon';
import { ReauthModal } from '@/components/auth/ReauthModal';
import { Radius, Space, getColors } from '@/constants/freehire';
import { authApi } from '@/features/auth/api/authApi';
import type { Identity } from '@/features/auth/model/authV2Types';
import { useIdentities } from '@/hooks/useIdentities';
import { useRecentAuth } from '@/hooks/useRecentAuth';
import { useAuth } from '@/lib/authStore';
import { formatDate } from '@/lib/format';
import { ApiError } from '@/lib/transport';

function providerDisplayName(provider: string): string {
  const map: Record<string, string> = {
    google: 'Google',
    github: 'GitHub',
    apple: 'Apple',
    linkedin: 'LinkedIn',
  };
  return map[provider.toLowerCase()] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function SecurityScreen() {
  const c = getColors(useColorScheme());
  const { user, sessionEpoch, logoutAll } = useAuth();
  const { identities, isLoading: identitiesLoading, isError: identitiesError, refetch: refetchIdentities, unlinkIdentity, isUnlinking, unlinkingProvider } = useIdentities();
  const { hasRecentAuth, clearRecentAuth, recordRecentAuth } = useRecentAuth();

  // Reauth modal state & promise resolver for gating
  const [reauthVisible, setReauthVisible] = useState(false);
  const reauthResolverRef = useRef<((value: boolean) => void) | null>(null);

  const promptReauth = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      reauthResolverRef.current = resolve;
      setReauthVisible(true);
    });
  }, []);

  const handleReauthSuccess = (proof: unknown) => {
    if (proof && typeof proof === 'object' && 'recent_auth_expires_at' in proof) {
      recordRecentAuth((proof as { recent_auth_expires_at: string }).recent_auth_expires_at);
    }
    setReauthVisible(false);
    if (reauthResolverRef.current) {
      reauthResolverRef.current(true);
      reauthResolverRef.current = null;
    }
  };

  const handleReauthClose = () => {
    setReauthVisible(false);
    if (reauthResolverRef.current) {
      reauthResolverRef.current(false);
      reauthResolverRef.current = null;
    }
  };

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Logout All State
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);

  const hasPassword = user?.has_password !== false;
  const activeIdentitiesCount = identities.filter((i) => i.status === 'active').length;

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword.length > 72) {
      setPasswordError('New password cannot exceed 72 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordBusy(true);
    try {
      if (!hasRecentAuth) {
        const authed = await promptReauth();
        if (!authed) {
          setPasswordBusy(false);
          return;
        }
      }

      await authApi.changePassword(currentPassword, newPassword, sessionEpoch);
      setPasswordSuccess('Password updated successfully. Other active sessions have been signed out.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      clearRecentAuth();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          // A 401 here is either a wrong current password or a session that
          // expired mid-edit — and the second case has already signed the user
          // out through the transport's unauthorized channel.
          setPasswordError(
            err.code === 'invalid_credentials'
              ? 'Current password is incorrect.'
              : 'Current password is incorrect, or your session expired. Sign in and try again.',
          );
        } else if (err.status === 428) {
          // Reauth required catch
          clearRecentAuth();
          const authed = await promptReauth();
          if (authed) {
            try {
              await authApi.changePassword(currentPassword, newPassword, sessionEpoch);
              setPasswordSuccess('Password updated successfully.');
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              clearRecentAuth();
            } catch (retryErr: unknown) {
              setPasswordError((retryErr as Error)?.message ?? 'Could not update password.');
            }
          }
        } else {
          setPasswordError(err.serverError ?? err.message ?? 'Could not update password.');
        }
      } else {
        setPasswordError((err as Error)?.message ?? 'Could not update password. Please try again.');
      }
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleUnlinkPress = (identity: Identity) => {
    const providerName = providerDisplayName(identity.provider);

    // Client-side guard for last sign-in method
    if (!hasPassword && activeIdentitiesCount <= 1) {
      Alert.alert(
        'Cannot Unlink',
        `You cannot unlink ${providerName} because it is your only sign-in method. Please set up a password first.`,
      );
      return;
    }

    Alert.alert(
      `Unlink ${providerName}?`,
      `Are you sure you want to remove ${providerName} as a sign-in method? You can reconnect it at any time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!hasRecentAuth) {
                const authed = await promptReauth();
                if (!authed) return;
              }

              const result = await unlinkIdentity(identity.provider);
              clearRecentAuth();

              if (result.status === 'revocation_pending') {
                Alert.alert(
                  'Unlinking in Progress',
                  `Disconnection for ${providerName} has been initiated and will complete shortly.`,
                );
              } else {
                Alert.alert('Unlinked', `${providerName} was unlinked successfully.`);
              }
            } catch (err: unknown) {
              if (err instanceof ApiError) {
                if (err.status === 428) {
                  clearRecentAuth();
                  const authed = await promptReauth();
                  if (authed) {
                    try {
                      const res = await unlinkIdentity(identity.provider);
                      clearRecentAuth();
                      if (res.status === 'revocation_pending') {
                        Alert.alert('Unlinking in Progress', `Disconnection for ${providerName} initiated.`);
                      } else {
                        Alert.alert('Unlinked', `${providerName} was unlinked successfully.`);
                      }
                    } catch (retryErr: unknown) {
                      Alert.alert('Error', (retryErr as Error)?.message ?? 'Unlink failed.');
                    }
                  }
                  return;
                }
                if (err.status === 409 && err.code === 'last_sign_in_method') {
                  Alert.alert(
                    'Cannot Unlink',
                    'Cannot remove your only sign-in method. Please configure another method first.',
                  );
                  return;
                }
              }
              Alert.alert('Error', (err as Error)?.message ?? 'Could not unlink provider.');
            }
          },
        },
      ],
    );
  };

  const handleLogoutAllPress = () => {
    Alert.alert(
      'Sign Out Everywhere?',
      'You will be signed out on this device and all other active mobile and web sessions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out Everywhere',
          style: 'destructive',
          onPress: async () => {
            setLogoutAllBusy(true);
            try {
              await logoutAll();
            } catch (err: unknown) {
              Alert.alert('Error', (err as Error)?.message ?? 'Could not sign out of all devices.');
            } finally {
              setLogoutAllBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.background }]}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: c.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <AppSymbol name="chevron.left" size={20} tintColor={c.foreground} />
          <Text style={[styles.backText, { color: c.foreground }]}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>Security</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Section 1: Password Management */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>Password</Text>

            {hasPassword ? (
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.cardDescription, { color: c.mutedForeground }]}>
                  Update your account password. Minimum 8 characters.
                </Text>

                {passwordSuccess ? (
                  <View style={[styles.banner, { backgroundColor: c.brandMuted, borderColor: c.brand }]}>
                    <AppSymbol name="checkmark.circle.fill" size={16} tintColor={c.brandStrong} />
                    <Text style={[styles.bannerText, { color: c.brandStrong }]}>{passwordSuccess}</Text>
                  </View>
                ) : null}

                {passwordError ? (
                  <View style={[styles.banner, { backgroundColor: c.destructiveMuted, borderColor: c.destructive }]}>
                    <AppSymbol name="exclamationmark.circle.fill" size={16} tintColor={c.destructive} />
                    <Text style={[styles.bannerText, { color: c.destructive }]}>{passwordError}</Text>
                  </View>
                ) : null}

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: c.foreground }]}>Current Password</Text>
                  <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                    <TextInput
                      style={[styles.textInput, { color: c.foreground }]}
                      placeholder="Enter current password"
                      placeholderTextColor={c.mutedForeground}
                      secureTextEntry={!showCurrent}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel="Current Password"
                    />
                    <Pressable
                      onPress={() => setShowCurrent((p) => !p)}
                      style={styles.eyeBtn}
                      accessibilityLabel={showCurrent ? 'Hide current password' : 'Show current password'}>
                      <AppSymbol name={showCurrent ? 'eye.slash' : 'eye'} size={18} tintColor={c.mutedForeground} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: c.foreground }]}>New Password</Text>
                  <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                    <TextInput
                      style={[styles.textInput, { color: c.foreground }]}
                      placeholder="At least 8 characters"
                      placeholderTextColor={c.mutedForeground}
                      secureTextEntry={!showNew}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel="New Password"
                    />
                    <Pressable
                      onPress={() => setShowNew((p) => !p)}
                      style={styles.eyeBtn}
                      accessibilityLabel={showNew ? 'Hide new password' : 'Show new password'}>
                      <AppSymbol name={showNew ? 'eye.slash' : 'eye'} size={18} tintColor={c.mutedForeground} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: c.foreground }]}>Confirm New Password</Text>
                  <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                    <TextInput
                      style={[styles.textInput, { color: c.foreground }]}
                      placeholder="Confirm new password"
                      placeholderTextColor={c.mutedForeground}
                      secureTextEntry={!showConfirm}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel="Confirm New Password"
                    />
                    <Pressable
                      onPress={() => setShowConfirm((p) => !p)}
                      style={styles.eyeBtn}
                      accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}>
                      <AppSymbol name={showConfirm ? 'eye.slash' : 'eye'} size={18} tintColor={c.mutedForeground} />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  onPress={handleChangePassword}
                  disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: c.brand },
                    (passwordBusy || !currentPassword || !newPassword || !confirmPassword) && styles.disabled,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Update Password">
                  {passwordBusy ? (
                    <ActivityIndicator color={c.brandForeground} />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: c.brandForeground }]}>Update Password</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.cardTitle, { color: c.foreground }]}>Social Authentication</Text>
                <Text style={[styles.cardDescription, { color: c.mutedForeground }]}>
                  You currently sign in with connected social accounts and do not have a password set.
                </Text>
                <Pressable
                  onPress={() => router.push('/auth?mode=forgot')}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: c.border, backgroundColor: c.background },
                    pressed && { backgroundColor: c.accent },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Set up a password">
                  <Text style={[styles.secondaryButtonText, { color: c.foreground }]}>Set up a password</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Section 2: Connected Accounts */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>Connected Accounts</Text>
            <Text style={[styles.sectionSubtitle, { color: c.mutedForeground }]}>
              Social identities connected to your FreeHire account.
            </Text>

            {identitiesLoading ? (
              <ActivityIndicator color={c.mutedForeground} style={{ marginVertical: Space.md }} />
            ) : identitiesError ? (
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center' }]}>
                <Text style={[styles.errorText, { color: c.destructive }]}>Failed to load connected accounts.</Text>
                <Pressable onPress={() => refetchIdentities()} style={styles.retryBtn}>
                  <Text style={{ color: c.brand, fontWeight: '600' }}>Retry</Text>
                </Pressable>
              </View>
            ) : identities.length === 0 ? (
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                  No external identities linked.
                </Text>
              </View>
            ) : (
              <View style={[styles.cardList, { borderColor: c.border, backgroundColor: c.card }]}>
                {identities.map((identity, index) => {
                  const isUnlinkingCurrent = isUnlinking && unlinkingProvider === identity.provider;
                  const canUnlink = identity.can_unlink !== false && (hasPassword || activeIdentitiesCount > 1);
                  const isRevocationPending = identity.status === 'revocation_pending';

                  return (
                    <View
                      key={identity.provider}
                      style={[
                        styles.identityRow,
                        index < identities.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
                      ]}>
                      <View style={styles.identityLeft}>
                        <View style={[styles.iconWrapper, { backgroundColor: c.background, borderColor: c.border }]}>
                          <ProviderIcon provider={identity.provider} size={20} color={c.foreground} />
                        </View>
                        <View style={styles.identityInfo}>
                          <View style={styles.identityNameRow}>
                            <Text style={[styles.identityName, { color: c.foreground }]}>
                              {providerDisplayName(identity.provider)}
                            </Text>
                            {isRevocationPending ? (
                              <View style={[styles.pendingBadge, { backgroundColor: c.accent }]}>
                                <Text style={[styles.pendingBadgeText, { color: c.mutedForeground }]}>
                                  Pending
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          {identity.provider_email ? (
                            <Text style={[styles.identityEmail, { color: c.mutedForeground }]} numberOfLines={1}>
                              {identity.provider_email}
                            </Text>
                          ) : identity.linked_at ? (
                            <Text style={[styles.identityLinkedAt, { color: c.mutedForeground }]}>
                              Linked {formatDate(identity.linked_at)}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <Pressable
                        onPress={() => handleUnlinkPress(identity)}
                        disabled={!canUnlink || isUnlinking}
                        style={({ pressed }) => [
                          styles.unlinkButton,
                          { borderColor: canUnlink ? c.destructive : c.border },
                          (!canUnlink || isUnlinking) && styles.disabled,
                          pressed && { opacity: 0.7 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Unlink ${providerDisplayName(identity.provider)}`}>
                        {isUnlinkingCurrent ? (
                          <ActivityIndicator size="small" color={c.destructive} />
                        ) : (
                          <Text
                            style={[
                              styles.unlinkButtonText,
                              { color: canUnlink ? c.destructive : c.mutedForeground },
                            ]}>
                            Unlink
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Section 3: Active Sessions / Sign Out Everywhere */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>Active Sessions</Text>
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.cardDescription, { color: c.mutedForeground }]}>
                Sign out of all active mobile and web sessions across all your devices.
              </Text>
              <Pressable
                onPress={handleLogoutAllPress}
                disabled={logoutAllBusy}
                style={({ pressed }) => [
                  styles.logoutAllButton,
                  { borderColor: c.border, backgroundColor: c.background },
                  logoutAllBusy && styles.disabled,
                  pressed && { backgroundColor: c.accent },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sign out of all devices">
                {logoutAllBusy ? (
                  <ActivityIndicator color={c.foreground} />
                ) : (
                  <Text style={[styles.logoutAllButtonText, { color: c.foreground }]}>
                    Sign out of all devices
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Section 4: Danger Zone / Account Deletion */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.destructive }]}>Danger Zone</Text>
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.destructiveMuted }]}>
              <Text style={[styles.cardDescription, { color: c.mutedForeground }]}>
                Permanently delete your account and all associated data.
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
      </KeyboardAvoidingView>

      {/* Embedded Reauthentication Modal */}
      <ReauthModal
        visible={reauthVisible}
        onClose={handleReauthClose}
        onSuccess={handleReauthSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
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
    paddingBottom: Space.xl + 8,
    gap: Space.xl,
  },
  section: {
    gap: Space.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: Space.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  formGroup: {
    gap: Space.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    height: 46,
    paddingHorizontal: Space.md,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  eyeBtn: {
    padding: Space.xs,
  },
  primaryButton: {
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.xs,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 42,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardList: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    gap: Space.md,
  },
  identityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    flex: 1,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityInfo: {
    flex: 1,
    gap: 2,
  },
  identityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  identityName: {
    fontSize: 15,
    fontWeight: '600',
  },
  identityEmail: {
    fontSize: 12,
  },
  identityLinkedAt: {
    fontSize: 12,
  },
  pendingBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  unlinkButton: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlinkButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  logoutAllButton: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutAllButtonText: {
    fontSize: 14,
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
  emptyText: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
  },
  retryBtn: {
    marginTop: Space.xs,
    padding: Space.xs,
  },
  disabled: {
    opacity: 0.5,
  },
});
