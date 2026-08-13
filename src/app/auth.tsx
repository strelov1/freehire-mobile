import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProviderIcon } from '@/components/ProviderIcon';
import { authMessage, ApiError } from '@/lib/api';
import { useAuth, useOAuthProviders } from '@/lib/authStore';
import { getColors, Radius, Space } from '@/constants/freehire';

type Mode = 'login' | 'register';

/** Provider display names; unknown slugs fall back to a capitalized form. */
const PROVIDER_LABELS: Record<string, string> = {
  github: 'GitHub',
  google: 'Google',
  linkedin: 'LinkedIn',
};

function providerLabel(p: string): string {
  return PROVIDER_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

/**
 * The sign-in / sign-up modal. A segmented toggle switches between logging in
 * and creating an account; both share the email + password fields and submit
 * through the auth store (which stores the session cookie). Server errors are
 * surfaced verbatim via `authMessage`. On success the modal simply closes — the
 * caller re-reads auth state from the store.
 */
export default function AuthScreen() {
  const c = getColors(useColorScheme());
  const { signIn, signUp, signInWithProvider } = useAuth();
  const providers = useOAuthProviders();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);

  const disabled = busy || oauthBusy != null;

  async function onProvider(provider: string) {
    if (disabled) return;
    setOauthBusy(provider);
    setError(null);
    try {
      if (await signInWithProvider(provider)) router.back(); // stay open if cancelled
    } catch {
      setError(`Couldn’t sign in with ${providerLabel(provider)}. Please try again.`);
    } finally {
      setOauthBusy(null);
    }
  }

  const isRegister = mode === 'register';
  const canSubmit = email.trim().length > 0 && password.length > 0 && !disabled;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const run = isRegister ? signUp : signIn;
      await run(email.trim(), password);
      router.back();
    } catch (e) {
      setError(
        e instanceof ApiError ? authMessage(e.status, e.serverError) : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.foreground }]}>
          {isRegister ? 'Create account' : 'Sign in'}
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <SymbolView name="xmark" size={20} weight="semibold" tintColor={c.foreground} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}>
        <View style={styles.body}>
          {/* Social sign-in, when the backend advertises providers. Cancelling a
              provider flow is a silent no-op; only real failures show an error. */}
          {providers.length > 0 ? (
            <View style={styles.social}>
              <View style={styles.providers}>
                {providers.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => onProvider(p)}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.providerBtn,
                      { borderColor: c.border, backgroundColor: c.card },
                      disabled && { opacity: 0.6 },
                      pressed && { opacity: 0.7 },
                    ]}>
                    {oauthBusy === p ? (
                      <ActivityIndicator color={c.foreground} />
                    ) : (
                      <View style={styles.providerContent}>
                        <ProviderIcon provider={p} size={18} color={c.foreground} />
                        <Text style={[styles.providerText, { color: c.foreground }]}>
                          Continue with {providerLabel(p)}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
                <Text style={[styles.dividerText, { color: c.mutedForeground }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
              </View>
            </View>
          ) : null}

          {/* Login / Register segmented toggle. */}
          <View style={[styles.segment, { backgroundColor: c.muted }]}>
            {(['login', 'register'] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  style={[styles.segmentBtn, active && { backgroundColor: c.card }]}>
                  <Text
                    style={[styles.segmentText, { color: active ? c.foreground : c.mutedForeground }]}>
                    {m === 'login' ? 'Log in' : 'Register'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fields}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={c.mutedForeground}
              style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={isRegister ? 'Password (min 8 characters)' : 'Password'}
              placeholderTextColor={c.mutedForeground}
              style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={isRegister ? 'new-password' : 'password'}
              textContentType={isRegister ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            {error ? <Text style={[styles.error, { color: c.destructive }]}>{error}</Text> : null}

            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: c.brand },
                !canSubmit && { opacity: 0.5 },
                pressed && canSubmit && { opacity: 0.85 },
              ]}>
              {busy ? (
                <ActivityIndicator color={c.brandForeground} />
              ) : (
                <Text style={[styles.submitText, { color: c.brandForeground }]}>
                  {isRegister ? 'Create account' : 'Log in'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingTop: Space.sm,
    gap: Space.xl,
  },
  social: {
    gap: Space.md,
  },
  providers: {
    gap: Space.sm,
  },
  providerBtn: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  providerText: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 13,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: Radius.md,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
  },
  fields: {
    gap: Space.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.md,
    height: 48,
    fontSize: 16,
  },
  error: {
    fontSize: 14,
    lineHeight: 19,
  },
  submit: {
    borderRadius: Radius.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.xs,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
