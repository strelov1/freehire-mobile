import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { ReauthModal } from '@/components/auth/ReauthModal';
import { Radius, Space, getColors } from '@/constants/freehire';
import { storeSubscriptionsURL } from '@/features/billing/storeLinks';
import { isRecentAuthRequiredError, useRecentAuth } from '@/hooks/useRecentAuth';
import { useAuth } from '@/lib/authStore';
import { ApiError } from '@/lib/transport';


export default function DeleteAccountScreen() {
  const c = getColors(useColorScheme());
  const { user, state, deleteAccount, retryBootstrap, recordReturnIntent } = useAuth();
  const { hasRecentAuth, clearRecentAuth, recordRecentAuth } = useRecentAuth();

  const [confirmEmail, setConfirmEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const userEmail = user?.email ?? '';
  const isEmailMatched =
    userEmail.length > 0 &&
    confirmEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();

  const handleOpenSubscriptions = async () => {
    const subUrl = storeSubscriptionsURL();
    try {
      await WebBrowser.openBrowserAsync(subUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      });
    } catch {
      // quiet fallback
    }
  };

  const executeDeletion = async (targetEmail: string) => {
    try {
      await deleteAccount(targetEmail);
      // Navigation on successful 204 deletion
      router.replace('/');
    } catch (err: unknown) {
      if (isRecentAuthRequiredError(err)) {
        clearRecentAuth();
        const authed = await promptReauth();
        if (authed) {
          try {
            await deleteAccount(targetEmail);
            router.replace('/');
            return;
          } catch (retryErr: unknown) {
            handleDeletionError(retryErr);
            return;
          }
        } else {
          return;
        }
      }
      handleDeletionError(err);
    }
  };

  const handleDeletionError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 400) {
        setErrorMessage('Please confirm deletion by entering your exact account email.');
      } else if (err.status === 503 || err.serverError?.includes('stored files')) {
        setErrorMessage('Could not erase your stored files; nothing was deleted, please try again.');
      } else if (err.status === 429) {
        setErrorMessage('Too many attempts. Please try again later.');
      } else if (err.kind === 'offline') {
        setErrorMessage('You appear to be offline. Check your connection and try again.');
      } else {
        setErrorMessage(err.serverError ?? err.message ?? 'Could not delete account. Please try again.');
      }
    } else {
      setErrorMessage((err as Error)?.message ?? 'Could not delete account. Please try again.');
    }
    setIsDeleting(false);
  };

  const handleDeletePress = async () => {
    if (!isEmailMatched || isDeleting || !user) return;

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      if (!hasRecentAuth) {
        const authed = await promptReauth();
        if (!authed) return;
      }

      await executeDeletion(user.email);
    } catch (err: unknown) {
      handleDeletionError(err);
    } finally {
      // Covers every exit — cancelled prompt, thrown reauth, handled failure —
      // so the button can never stay stuck in its spinner.
      setIsDeleting(false);
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

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.background }]}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: c.border }]}>
        <Pressable
          // Deep link or push leaves an empty stack; without the fallback the
          // only way off a screen that deletes the account is to kill the app.
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
          disabled={isDeleting}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <AppSymbol name="chevron.left" size={20} tintColor={c.foreground} />
          <Text style={[styles.backText, { color: c.foreground }]}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>Delete Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Error Banner */}
          {errorMessage ? (
            <View style={[styles.banner, { backgroundColor: c.destructiveMuted, borderColor: c.destructive }]}>
              <AppSymbol name="exclamationmark.circle.fill" size={18} tintColor={c.destructive} />
              <Text style={[styles.bannerText, { color: c.destructive }]}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Warning Card */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.destructive }]}>
            <View style={styles.warningHeader}>
              <AppSymbol name="exclamationmark.circle.fill" size={22} tintColor={c.destructive} />
              <Text style={[styles.cardTitle, { color: c.destructive }]}>Permanent Data Deletion</Text>
            </View>
            <Text style={[styles.warningText, { color: c.foreground }]}>
              This action is permanent and cannot be undone. All your personal data and account records will be permanently erased immediately:
            </Text>
            <View style={styles.lossList}>
              <View style={styles.lossItem}>
                <Text style={[styles.bullet, { color: c.destructive }]}>•</Text>
                <Text style={[styles.lossItemText, { color: c.mutedForeground }]}>
                  Your user profile, settings, and connected identities
                </Text>
              </View>
              <View style={styles.lossItem}>
                <Text style={[styles.bullet, { color: c.destructive }]}>•</Text>
                <Text style={[styles.lossItemText, { color: c.mutedForeground }]}>
                  All uploaded resumes, CVs, and parsed candidate records
                </Text>
              </View>
              <View style={styles.lossItem}>
                <Text style={[styles.bullet, { color: c.destructive }]}>•</Text>
                <Text style={[styles.lossItemText, { color: c.mutedForeground }]}>
                  Submitted job applications, interview tracks, and email mailboxes
                </Text>
              </View>
              <View style={styles.lossItem}>
                <Text style={[styles.bullet, { color: c.destructive }]}>•</Text>
                <Text style={[styles.lossItemText, { color: c.mutedForeground }]}>
                  Saved job searches, job match recommendations, and credit balances
                </Text>
              </View>
            </View>
          </View>

          {/* Store Subscription Non-Cancellation Disclosure (Apple Guideline 5.1.1 & Store Compliance) */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.disclosureHeader}>
              <AppSymbol name="creditcard" size={20} tintColor={c.foreground} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Active Subscriptions Notice</Text>
            </View>
            <Text style={[styles.disclosureText, { color: c.mutedForeground }]}>
              Deleting your account does not cancel active App Store or Google Play subscriptions. Please manage or cancel subscriptions in your device settings.
            </Text>
            <Pressable
              onPress={handleOpenSubscriptions}
              style={({ pressed }) => [
                styles.manageSubscriptionsButton,
                { borderColor: c.border, backgroundColor: c.background },
                pressed && { backgroundColor: c.accent },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Manage Device Subscriptions">
              <Text style={[styles.manageSubscriptionsText, { color: c.brandStrong }]}>
                Manage Subscriptions
              </Text>
              <AppSymbol name="arrow.up.right" size={14} tintColor={c.brandStrong} />
            </Pressable>
          </View>

          {/* Email Confirmation Gate */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>Confirm Account Email</Text>
            <Text style={[styles.instructionText, { color: c.mutedForeground }]}>
              To prevent accidental deletion, please type your email (<Text style={{ fontWeight: '700', color: c.foreground }}>{user.email}</Text>) to confirm:
            </Text>

            <View style={styles.formGroup}>
              <View style={[styles.inputRow, { borderColor: c.border, backgroundColor: c.background }]}>
                <TextInput
                  style={[styles.textInput, { color: c.foreground }]}
                  placeholder={user.email}
                  placeholderTextColor={c.mutedForeground}
                  value={confirmEmail}
                  onChangeText={setConfirmEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isDeleting}
                  accessibilityLabel="Confirm email"
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionGroup}>
              <Pressable
                onPress={handleDeletePress}
                disabled={!isEmailMatched || isDeleting}
                style={({ pressed }) => [
                  styles.deleteButton,
                  { backgroundColor: c.destructive },
                  (!isEmailMatched || isDeleting) && styles.disabled,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Delete Account Permanently">
                {isDeleting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete Account Permanently</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
                disabled={isDeleting}
                style={({ pressed }) => [
                  styles.cancelButton,
                  { borderColor: c.border, backgroundColor: c.background },
                  pressed && { backgroundColor: c.accent },
                  isDeleting && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Cancel">
                <Text style={[styles.cancelButtonText, { color: c.foreground }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Embedded Reauthentication Modal for Recent-Auth gating */}
      <ReauthModal
        visible={reauthVisible}
        onClose={handleReauthClose}
        onSuccess={handleReauthSuccess}
        title="Confirm Deletion"
        description="For security, verify your identity before permanently deleting your account."
      />
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
    gap: Space.lg,
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
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: Space.md,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  lossList: {
    gap: Space.xs,
    paddingLeft: Space.xs,
  },
  lossItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.xs,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  lossItemText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  disclosureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  disclosureText: {
    fontSize: 13,
    lineHeight: 18,
  },
  manageSubscriptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginTop: 2,
  },
  manageSubscriptionsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  formGroup: {
    gap: Space.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    height: 48,
    paddingHorizontal: Space.md,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  actionGroup: {
    gap: Space.sm,
    marginTop: Space.xs,
  },
  deleteButton: {
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
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
