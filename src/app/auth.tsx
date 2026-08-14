import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
import Svg, { Circle, Path } from 'react-native-svg';

import { ProviderIcon } from '@/components/ProviderIcon';
import { SessionUnavailable } from '@/components/SessionUnavailable';
import { getColors } from '@/constants/freehire';
import { authMessage } from '@/features/auth/api/authApi';
import { authRouteShouldLeave } from '@/features/auth/model/authRouting';
import { useAuth, useOAuthProviders } from '@/lib/authStore';

type Mode = 'login' | 'register';

const PROVIDER_LABELS: Record<string, string> = {
  github: 'GitHub',
  google: 'Google',
  linkedin: 'LinkedIn',
  apple: 'Apple',
};

function providerLabel(p: string): string {
  return PROVIDER_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

function EyeIcon({ size = 20, color = '#7C7C75', off = false }: { size?: number; color?: string; off?: boolean }) {
  if (off) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <Path d="M1 1l22 22" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

function CloseIcon({ size = 12, color = '#1C1C18' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <Path d="M1 1l10 10M11 1L1 11" />
    </Svg>
  );
}

/**
 * The Figma-styled sign-in / sign-up sheet modal with dual light/dark theme support.
 */
export default function AuthScreen() {
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

  const {
    state,
    returnIntent,
    signIn,
    signUp,
    signInWithProvider,
    retryBootstrap,
    clearReturnIntent,
    retryReturnIntent,
  } = useAuth();
  const providers = useOAuthProviders();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const authStartedHere = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        scrollRef.current?.scrollTo({ y: 160, animated: true });
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const disabled = busy || oauthBusy != null;

  function navigateBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  useEffect(() => {
    if (authStartedHere.current || !authRouteShouldLeave(state)) return;
    if (returnIntent.status === 'executing' || returnIntent.status === 'completed') return;
    if (returnIntent.status === 'pending') {
      void retryReturnIntent().then((result) => {
        if (result === 'none') navigateBack();
      });
      return;
    }
    if (returnIntent.status === 'failed') return;
    navigateBack();
  }, [state, returnIntent.status, retryReturnIntent]);

  function dismiss() {
    clearReturnIntent();
    navigateBack();
  }

  async function onProvider(provider: string) {
    if (disabled) return;
    setOauthBusy(provider);
    authStartedHere.current = true;
    setError(null);
    try {
      const result = await signInWithProvider(provider);
      if (result.status === 'success' && result.intent === 'none') navigateBack();
      if (result.status === 'success' && result.intent === 'failed') {
        setError('Signed in, but the requested action failed. Retry it below.');
      }
    } catch (caught) {
      setError(authMessage(caught, 'oauth'));
    } finally {
      setOauthBusy(null);
    }
  }

  const isRegister = mode === 'register';
  const canSubmit = email.trim().length > 0 && password.length > 0 && !disabled;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    authStartedHere.current = true;
    setError(null);
    try {
      const run = isRegister ? signUp : signIn;
      const result = await run(email.trim(), password);
      if (result.status === 'success' && result.intent === 'none') navigateBack();
      if (result.status === 'success' && result.intent === 'failed') {
        setError('Signed in, but the requested action failed. Retry it below.');
      }
    } catch (e) {
      setError(authMessage(e, isRegister ? 'register' : 'login'));
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  if (authRouteShouldLeave(state) && returnIntent.status === 'failed') {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.stateText, { color: theme.mutedText }]}>Signed in, but the requested action failed.</Text>
        <Pressable onPress={() => void retryReturnIntent()} style={[styles.submitBtn, { backgroundColor: theme.brand }]}>
          <Text style={[styles.submitText, { color: theme.brandText }]}>Retry action</Text>
        </Pressable>
        <Pressable onPress={dismiss}>
          <Text style={[styles.retryLink, { color: theme.brand }]}>Continue browsing</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (state.status === 'bootstrapping' || state.status === 'authenticating' || authRouteShouldLeave(state)) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.brand} />
      </SafeAreaView>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: theme.background }]}>
        <SessionUnavailable onRetry={retryBootstrap} onDismiss={dismiss} dismissText="Continue browsing" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        {/* Header section with top handle indicator and title row */}
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: theme.handle }]} />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>
              {isRegister ? 'Create account' : 'Sign in'}
            </Text>
            <Pressable
              onPress={dismiss}
              hitSlop={12}
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
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 120 : 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          bounces={true}
          overScrollMode="always">
          {/* Social Sign-in section */}
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
                      { borderColor: theme.border, backgroundColor: theme.card },
                      disabled && { opacity: 0.6 },
                      pressed && { opacity: 0.7 },
                    ]}>
                    {oauthBusy === p ? (
                      <ActivityIndicator color={theme.text} />
                    ) : (
                      <View style={styles.providerContent}>
                        <ProviderIcon provider={p} size={18} color={theme.text} />
                        <Text style={[styles.providerText, { color: theme.text }]}>
                          Continue with {providerLabel(p)}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.mutedText }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>
            </View>
          ) : null}

          {/* Segmented Control */}
          <View style={[styles.segmentContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {(['login', 'register'] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  style={[
                    styles.segmentTab,
                    active
                      ? [styles.segmentActive, { backgroundColor: theme.brand }]
                      : styles.segmentInactive,
                  ]}>
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? theme.brandText : theme.mutedText, fontWeight: active ? '600' : '500' },
                    ]}>
                    {m === 'login' ? 'Log in' : 'Register'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Form Inputs */}
          <View style={styles.form}>
            {/* Email Field */}
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
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                />
              </Pressable>
            </View>

            {/* Password Field */}
            <View style={styles.inputField}>
              <Pressable onPress={() => passwordInputRef.current?.focus()} hitSlop={6}>
                <Text style={[styles.fieldLabel, { color: theme.mutedText }]}>PASSWORD</Text>
              </Pressable>
              <Pressable
                onPress={() => passwordInputRef.current?.focus()}
                style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <TextInput
                  ref={passwordInputRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={isRegister ? 'Min 8 characters' : '••••••••••••'}
                  placeholderTextColor={theme.mutedText}
                  style={[styles.inputText, { color: theme.text }]}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete={isRegister ? 'new-password' : 'password'}
                  textContentType={isRegister ? 'newPassword' : 'password'}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={12} style={styles.eyeBtn}>
                  <EyeIcon size={20} color={theme.mutedText} off={!showPassword} />
                </Pressable>
              </Pressable>
            </View>

            {error ? <Text style={[styles.errorText, { color: theme.errorText }]}>{error}</Text> : null}

            {returnIntent.status === 'failed' ? (
              <Pressable onPress={() => void retryReturnIntent()}>
                <Text style={[styles.retryLink, { color: theme.brand }]}>Retry requested action</Text>
              </Pressable>
            ) : null}

            {/* Submit Action Button */}
            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: theme.brand, marginTop: 8 },
                !canSubmit && { opacity: 0.5 },
                pressed && canSubmit && { opacity: 0.85 },
              ]}>
              {busy ? (
                <ActivityIndicator color={theme.brandText} />
              ) : (
                <Text style={[styles.submitText, { color: theme.brandText }]}>
                  {isRegister ? 'Create account' : 'Log in'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  stateText: { fontSize: 15, textAlign: 'center' },
  retryLink: { fontSize: 15, fontWeight: '600' },
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
    paddingBottom: 24,
    gap: 24,
  },
  social: {
    gap: 16,
  },
  providers: {
    gap: 12,
  },
  providerBtn: {
    borderWidth: 1,
    borderRadius: 100,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  providerText: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 13,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 100,
    padding: 4,
    height: 48,
  },
  segmentTab: {
    flex: 1,
    height: 40,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    borderRadius: 100,
  },
  segmentInactive: {},
  segmentText: {
    fontSize: 14,
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
  eyeBtn: {
    paddingLeft: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
});
