import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { ProviderButton } from '@/components/auth/ProviderButton';
import { Radius, Space, getColors } from '@/constants/freehire';
import type { RecentAuthProof } from '@/features/auth/model/authV2Types';
import { useProviders } from '@/hooks/useProviders';
import { recordRecentAuth, useRecentAuth } from '@/hooks/useRecentAuth';
import { useAuth } from '@/lib/authStore';
import { ApiError } from '@/lib/transport';

export type ReauthModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (proof: RecentAuthProof | string) => void;
  title?: string;
  description?: string;
};

function formatErrorMessage(err: unknown): string {
  if (!err) return 'Verification failed. Please try again.';
  if (err instanceof ApiError) {
    if (err.status === 401 || err.code === 'invalid_credentials') {
      return 'Invalid password. Please try again.';
    }
    if (err.code === 'reauth_identity_mismatch' || err.serverError?.includes('mismatch')) {
      return 'Please use the same account you signed in with.';
    }
    if (err.status === 429) {
      return 'Too many attempts. Please try again later.';
    }
    if (err.kind === 'offline') {
      return 'You appear to be offline. Check your connection and try again.';
    }
    if (err.serverError) {
      return err.serverError;
    }
  }
  if (typeof err === 'object' && err !== null) {
    const record = err as Record<string, unknown>;
    if (record.code === 1001 || record.code === 'ERR_CANCELED' || record.message === 'reauth_cancelled') {
      return '';
    }
    if (typeof record.message === 'string' && record.message) {
      return record.message;
    }
  }
  return 'Verification failed. Please try again.';
}

/**
 * Re-authentication modal bottom sheet displayed when a user attempts a sensitive action
 * (e.g. changing password, unlinking an identity, deleting account) or when an HTTP 428 is caught.
 *
 * Supports Password verification (with secure show/hide toggle), native Apple Reauth on iOS,
 * and Browser OAuth reauth (Google, GitHub, LinkedIn).
 */
export function ReauthModal({
  visible,
  onClose,
  onSuccess,
  title = "Confirm it's you",
  description = 'For your security, please confirm your identity before continuing.',
}: ReauthModalProps) {
  const c = getColors(useColorScheme());
  const { user } = useAuth();
  const { requestReauth } = useRecentAuth();
  const { providers } = useProviders();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasPassword = user?.has_password !== false;
  const oauthProviders = providers.filter((p) => p.flow === 'browser_oauth' && p.available !== false);
  const hasApple = Platform.OS === 'ios' && providers.some((p) => p.flow === 'native_apple' && p.available !== false);

  const handlePasswordSubmit = async () => {
    if (!password.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const proof = await requestReauth({ method: 'password', password });
      recordRecentAuth(proof);
      setPassword('');
      onSuccess(proof);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialSuccess = (result: unknown) => {
    setErrorMessage(null);
    if (result && typeof result === 'object' && 'recent_auth_expires_at' in result) {
      const proof = result as RecentAuthProof;
      recordRecentAuth(proof);
      onSuccess(proof);
      onClose();
    }
  };

  const handleSocialError = (err: unknown) => {
    const msg = formatErrorMessage(err);
    if (msg) {
      setErrorMessage(msg);
    }
  };

  const handleDismiss = () => {
    if (isSubmitting) return;
    setPassword('');
    setErrorMessage(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      accessibilityLabel={title}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}>
        <Pressable
          style={styles.dismissOverlay}
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close re-authentication dialog"
        />
        <View style={[styles.sheet, { backgroundColor: c.background, borderColor: c.border }]}>
          {/* Top handle bar */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: c.mutedForeground }]} />
          </View>

          {/* Header row */}
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
              <Text style={[styles.description, { color: c.mutedForeground }]}>{description}</Text>
            </View>
            <Pressable
              onPress={handleDismiss}
              disabled={isSubmitting}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <AppSymbol name="xmark" size={20} tintColor={c.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {errorMessage ? (
              <View style={[styles.errorBox, { backgroundColor: c.destructiveMuted, borderColor: c.destructive }]}>
                <AppSymbol name="exclamationmark.circle.fill" size={16} tintColor={c.destructive} />
                <Text style={[styles.errorText, { color: c.destructive }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Password Section */}
            {hasPassword ? (
              <View style={styles.passwordSection}>
                <Text style={[styles.inputLabel, { color: c.foreground }]}>Current Password</Text>
                <View style={[styles.inputContainer, { borderColor: c.border, backgroundColor: c.card }]}>
                  <TextInput
                    style={[styles.input, { color: c.foreground }]}
                    placeholder="Enter your password"
                    placeholderTextColor={c.mutedForeground}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                    returnKeyType="done"
                    onSubmitEditing={handlePasswordSubmit}
                    accessibilityLabel="Password"
                  />
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                    <AppSymbol
                      name={showPassword ? 'eye.slash' : 'eye'}
                      size={20}
                      tintColor={c.mutedForeground}
                    />
                  </Pressable>
                </View>

                <Pressable
                  onPress={handlePasswordSubmit}
                  disabled={!password.trim() || isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm with Password"
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: c.brand },
                    (!password.trim() || isSubmitting) && styles.disabled,
                    pressed && { opacity: 0.85 },
                  ]}>
                  {isSubmitting ? (
                    <ActivityIndicator color={c.brandForeground} />
                  ) : (
                    <Text style={[styles.submitButtonText, { color: c.brandForeground }]}>
                      Confirm with Password
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* Social Providers Divider */}
            {hasPassword && (hasApple || oauthProviders.length > 0) ? (
              <View style={styles.dividerContainer}>
                <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
                <Text style={[styles.dividerText, { color: c.mutedForeground }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
              </View>
            ) : null}

            {/* Native Apple Reauth */}
            {hasApple ? (
              <View style={styles.socialContainer}>
                <AppleSignInButton
                  purpose="reauth"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  onSuccess={handleSocialSuccess}
                  onError={handleSocialError}
                />
              </View>
            ) : null}

            {/* Browser OAuth Providers */}
            {oauthProviders.map((p) => (
              <View key={p.id} style={styles.socialContainer}>
                <ProviderButton
                  provider={p}
                  purpose="reauth"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  onSuccess={handleSocialSuccess}
                  onError={handleSocialError}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '90%',
    paddingBottom: Space.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Space.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingBottom: Space.md,
  },
  headerTextContainer: {
    flex: 1,
    gap: Space.xs,
    paddingRight: Space.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    padding: Space.xs,
    borderRadius: Radius.pill,
  },
  body: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xs,
    paddingBottom: Space.md,
    gap: Space.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  passwordSection: {
    gap: Space.xs,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    height: 48,
    paddingHorizontal: Space.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  eyeButton: {
    padding: Space.xs,
  },
  submitButton: {
    height: 46,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.sm,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginVertical: Space.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  socialContainer: {
    width: '100%',
  },
});
