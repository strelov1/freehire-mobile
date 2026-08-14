import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
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
import Svg, { Path } from 'react-native-svg';

import { getColors } from '@/constants/freehire';
import { authApi, authMessage } from '@/features/auth/api/authApi';

function CloseIcon({ size = 12, color = '#1C1C18' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Path d="M1 1l10 10M11 1L1 11" />
    </Svg>
  );
}

/**
 * Standalone route for requesting password recovery code (/auth/forgot).
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const c = getColors(useColorScheme());
  const theme = {
    background: c.background,
    card: c.card,
    border: c.border,
    text: c.foreground,
    mutedText: c.mutedForeground,
    brand: c.brand,
    brandText: c.brandForeground,
    handle: c.border,
    closeBg: c.card,
    closeBorder: c.border,
    errorText: c.destructive,
  };

  const [email, setEmail] = useState(() => params.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const emailInputRef = useRef<TextInput>(null);

  function dismiss() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/auth?mode=login');
    }
  }

  const canSubmit = email.trim().length > 0 && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err) {
      setError(authMessage(err, 'forgot'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: theme.handle }]} />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>Forgot password</Text>
            <Pressable
              onPress={dismiss}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: theme.closeBg, borderColor: theme.closeBorder },
                pressed && { opacity: 0.6 },
              ]}>
              <CloseIcon size={12} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <Text style={[styles.descriptionText, { color: theme.mutedText }]}>
            Enter your email address and we&apos;ll send you a password reset code.
          </Text>

          {submitted ? (
            <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.statusText, { color: theme.text }]}>
                Check your email! If an account exists for {email.trim()}, a reset code has been sent.
              </Text>
              <Pressable
                onPress={() => router.push({ pathname: '/auth/reset', params: { email: email.trim() } })}
                style={[styles.submitBtn, { backgroundColor: theme.brand, marginTop: 12 }]}>
                <Text style={[styles.submitText, { color: theme.brandText }]}>Enter reset code</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.inputField}>
                <Pressable onPress={() => emailInputRef.current?.focus()} hitSlop={6}>
                  <Text style={[styles.fieldLabel, { color: theme.mutedText }]}>EMAIL ADDRESS</Text>
                </Pressable>
                <Pressable
                  onPress={() => emailInputRef.current?.focus()}
                  style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <TextInput
                    ref={emailInputRef}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="hello@domain.com"
                    placeholderTextColor={theme.mutedText}
                    style={[styles.inputText, { color: theme.text }]}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                  />
                </Pressable>
              </View>

              {error ? <Text style={[styles.errorText, { color: theme.errorText }]}>{error}</Text> : null}

              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel="Send reset code"
                style={({ pressed }) => [
                  styles.submitBtn,
                  { backgroundColor: theme.brand, marginTop: 8 },
                  !canSubmit && { opacity: 0.5 },
                  pressed && canSubmit && { opacity: 0.85 },
                ]}>
                {busy ? (
                  <ActivityIndicator color={theme.brandText} />
                ) : (
                  <Text style={[styles.submitText, { color: theme.brandText }]}>Send reset code</Text>
                )}
              </Pressable>
            </View>
          )}

          <View style={styles.linkGroup}>
            <Pressable
              onPress={() => router.push({ pathname: '/auth/reset', params: { email: email.trim() } })}
              hitSlop={8}>
              <Text style={[styles.linkText, { color: theme.brand }]}>I already have a reset code</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/auth?mode=login')} hitSlop={8}>
              <Text style={[styles.linkText, { color: theme.mutedText }]}>Back to sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 16,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 100,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 20,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  inputField: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
  },
  inputText: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 19,
  },
  submitBtn: {
    height: 51,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
  },
  linkGroup: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
