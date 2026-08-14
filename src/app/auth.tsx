import { router, useLocalSearchParams } from 'expo-router';
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

import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { ProviderButton } from '@/components/auth/ProviderButton';
import { SessionUnavailable } from '@/components/SessionUnavailable';
import { getColors } from '@/constants/freehire';
import { authApi, authMessage } from '@/features/auth/api/authApi';
import type { AuthCompletion } from '@/features/auth/model/authTypes';
import type { RecentAuthProof } from '@/features/auth/model/authV2Types';
import { authRouteShouldLeave } from '@/features/auth/model/authRouting';
import { useProviders } from '@/hooks/useProviders';
import { useAuth } from '@/lib/authStore';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

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
 * Multi-Mode Auth Modal supporting 'login' | 'register' | 'forgot' | 'reset'.
 * Renders dynamic social buttons (Apple on iOS, Browser OAuth for others),
 * preserves return intents across modes, and handles password recovery workflows.
 */
export default function AuthScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    token?: string;
    code?: string;
    email?: string;
  }>();

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
    successBg: c.card,
    successText: c.foreground,
  };

  const {
    state,
    returnIntent,
    signIn,
    signUp,
    signInWithProviderV2,
    retryBootstrap,
    clearReturnIntent,
    retryReturnIntent,
  } = useAuth();

  const { providers } = useProviders();

  const initialMode =
    params.mode === 'register' || params.mode === 'forgot' || params.mode === 'reset'
      ? (params.mode as AuthMode)
      : params.token || params.code
        ? 'reset'
        : 'login';

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState(() => params.email ?? '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState(() => params.token ?? params.code ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const authStartedHere = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);

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

  async function onSocialSuccess(result: AuthCompletion | RecentAuthProof) {
    if ('status' in result && result.status === 'success' && result.intent === 'none') {
      navigateBack();
    }
    if ('status' in result && result.status === 'success' && result.intent === 'failed') {
      setError('Signed in, but the requested action failed. Retry it below.');
    }
  }

  function onSocialError(err: unknown) {
    setError(authMessage(err, 'oauth'));
  }

  async function onProvider(providerId: string) {
    if (disabled) return;
    setOauthBusy(providerId);
    authStartedHere.current = true;
    setError(null);
    setStatusMessage(null);
    try {
      const result = await signInWithProviderV2(providerId, 'sign_in');
      if ('status' in result && result.status === 'success') {
        if (result.intent === 'none') {
          navigateBack();
        } else if (result.intent === 'failed') {
          setError('Signed in, but the requested action failed. Retry it below.');
        }
      }
    } catch (caught) {
      setError(authMessage(caught, 'oauth'));
    } finally {
      setOauthBusy(null);
    }
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setStatusMessage(null);
    // Per-mode outcomes are not carried across: leaving them set shows a "check
    // your inbox" or "password reset" panel on top of the next mode's form.
    setForgotSubmitted(false);
    setResetSuccess(false);
  }

  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const isAuthTab = mode === 'login' || mode === 'register';

  // Submission validation
  const canSubmitAuth = email.trim().length > 0 && password.length > 0 && !disabled;
  const canSubmitForgot = email.trim().length > 0 && !disabled;
  const canSubmitReset = email.trim().length > 0 && code.trim().length > 0 && password.length >= 8 && !disabled;

  async function handleAuthSubmit() {
    if (!canSubmitAuth) return;
    setBusy(true);
    authStartedHere.current = true;
    setError(null);
    setStatusMessage(null);
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

  async function handleForgotSubmit() {
    if (!canSubmitForgot) return;
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      await authApi.forgotPassword(email.trim());
      setForgotSubmitted(true);
      setStatusMessage(`If an account exists for ${email.trim()}, a password reset code has been sent.`);
    } catch (e) {
      setError(authMessage(e, 'forgot'));
    } finally {
      setBusy(false);
    }
  }

  async function handleResetSubmit() {
    if (!canSubmitReset) return;
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      await authApi.resetPassword(email.trim(), code.trim(), password);
      setResetSuccess(true);
      setPassword('');
      setCode('');
      setStatusMessage('Password reset successfully. Please log in with your new password.');
    } catch (e) {
      setError(authMessage(e, 'reset'));
    } finally {
      setBusy(false);
    }
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

  const headerTitle =
    mode === 'login'
      ? 'Sign in'
      : mode === 'register'
        ? 'Create account'
        : mode === 'forgot'
          ? 'Forgot password'
          : 'Reset password';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.fill, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        {/* Header section with top handle indicator and title row */}
        <View style={styles.header}>
          <View style={[styles.handle, { backgroundColor: theme.handle }]} />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>{headerTitle}</Text>
            <Pressable
              onPress={dismiss}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close auth sheet"
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

          {/* Social Sign-in section (only for login and register modes) */}
          {isAuthTab && providers.length > 0 ? (
            <View style={styles.social}>
              <View style={styles.providers}>
                {providers.map((p) => {
                  if (p.flow === 'native_apple' && Platform.OS === 'ios') {
                    return (
                      <AppleSignInButton
                        key={p.id}
                        purpose="sign_in"
                        disabled={disabled}
                        loading={oauthBusy === p.id}
                        onSuccess={onSocialSuccess}
                        onError={onSocialError}
                      />
                    );
                  }
                  return (
                    <ProviderButton
                      key={p.id}
                      provider={p}
                      disabled={disabled}
                      loading={oauthBusy === p.id}
                      onPress={() => onProvider(p.id)}
                    />
                  );
                })}
              </View>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.mutedText }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>
            </View>
          ) : null}

          {/* Segmented Control (only for login and register modes) */}
          {isAuthTab ? (
            <View style={[styles.segmentContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {(['login', 'register'] as const).map((m) => {
                const active = mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => switchMode(m)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
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
          ) : null}

          {/* MODE: LOGIN or REGISTER */}
          {isAuthTab ? (
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
                    onSubmitEditing={handleAuthSubmit}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={12}
                    style={styles.eyeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityState={{ selected: showPassword }}>
                    <EyeIcon size={20} color={theme.mutedText} off={!showPassword} />
                  </Pressable>
                </Pressable>
              </View>

              {mode === 'login' ? (
                <View style={styles.forgotRow}>
                  <Pressable onPress={() => switchMode('forgot')} hitSlop={8}>
                    <Text style={[styles.linkText, { color: theme.brand }]}>Forgot password?</Text>
                  </Pressable>
                </View>
              ) : null}

              {statusMessage ? (
                <View style={[styles.statusCard, { backgroundColor: theme.successBg, borderColor: theme.border }]}>
                  <Text style={[styles.statusText, { color: theme.successText }]}>{statusMessage}</Text>
                </View>
              ) : null}

              {error ? <Text style={[styles.errorText, { color: theme.errorText }]}>{error}</Text> : null}

              {returnIntent.status === 'failed' ? (
                <Pressable onPress={() => void retryReturnIntent()}>
                  <Text style={[styles.retryLink, { color: theme.brand }]}>Retry requested action</Text>
                </Pressable>
              ) : null}

              {/* Submit Action Button */}
              <Pressable
                onPress={handleAuthSubmit}
                disabled={!canSubmitAuth}
                accessibilityRole="button"
                accessibilityLabel={isRegister ? 'Create account' : 'Log in'}
                style={({ pressed }) => [
                  styles.submitBtn,
                  { backgroundColor: theme.brand, marginTop: 8 },
                  !canSubmitAuth && { opacity: 0.5 },
                  pressed && canSubmitAuth && { opacity: 0.85 },
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
          ) : null}

          {/* MODE: FORGOT PASSWORD */}
          {isForgot ? (
            <View style={styles.form}>
              <Text style={[styles.descriptionText, { color: theme.mutedText }]}>
                Enter your email address and we&apos;ll send you a password reset code.
              </Text>

              {forgotSubmitted ? (
                <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.statusText, { color: theme.text }]}>
                    Check your email! If an account exists for {email.trim()}, a reset code has been sent.
                  </Text>
                  <Pressable
                    onPress={() => switchMode('reset')}
                    style={[styles.submitBtn, { backgroundColor: theme.brand, marginTop: 12 }]}>
                    <Text style={[styles.submitText, { color: theme.brandText }]}>Enter reset code</Text>
                  </Pressable>
                </View>
              ) : (
                <>
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
                        onSubmitEditing={handleForgotSubmit}
                      />
                    </Pressable>
                  </View>

                  {error ? <Text style={[styles.errorText, { color: theme.errorText }]}>{error}</Text> : null}

                  <Pressable
                    onPress={handleForgotSubmit}
                    disabled={!canSubmitForgot}
                    accessibilityRole="button"
                    accessibilityLabel="Send reset code"
                    style={({ pressed }) => [
                      styles.submitBtn,
                      { backgroundColor: theme.brand, marginTop: 8 },
                      !canSubmitForgot && { opacity: 0.5 },
                      pressed && canSubmitForgot && { opacity: 0.85 },
                    ]}>
                    {busy ? (
                      <ActivityIndicator color={theme.brandText} />
                    ) : (
                      <Text style={[styles.submitText, { color: theme.brandText }]}>Send reset code</Text>
                    )}
                  </Pressable>
                </>
              )}

              <View style={styles.linkGroup}>
                <Pressable onPress={() => switchMode('reset')} hitSlop={8}>
                  <Text style={[styles.linkText, { color: theme.brand }]}>I already have a reset code</Text>
                </Pressable>
                <Pressable onPress={() => switchMode('login')} hitSlop={8}>
                  <Text style={[styles.linkText, { color: theme.mutedText }]}>Back to sign in</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* MODE: RESET PASSWORD */}
          {isReset ? (
            <View style={styles.form}>
              <Text style={[styles.descriptionText, { color: theme.mutedText }]}>
                Enter the code sent to your email and your new password.
              </Text>

              {resetSuccess ? (
                <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.statusText, { color: theme.text }]}>
                    Your password has been successfully reset!
                  </Text>
                  <Pressable
                    onPress={() => switchMode('login')}
                    style={[styles.submitBtn, { backgroundColor: theme.brand, marginTop: 12 }]}>
                    <Text style={[styles.submitText, { color: theme.brandText }]}>Sign in now</Text>
                  </Pressable>
                </View>
              ) : (
                <>
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
                        onSubmitEditing={() => codeInputRef.current?.focus()}
                      />
                    </Pressable>
                  </View>

                  {/* Reset Code Field */}
                  <View style={styles.inputField}>
                    <Pressable onPress={() => codeInputRef.current?.focus()} hitSlop={6}>
                      <Text style={[styles.fieldLabel, { color: theme.mutedText }]}>RESET CODE</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => codeInputRef.current?.focus()}
                      style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <TextInput
                        ref={codeInputRef}
                        value={code}
                        onChangeText={setCode}
                        placeholder="e.g. 123456"
                        placeholderTextColor={theme.mutedText}
                        style={[styles.inputText, { color: theme.text }]}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                        onSubmitEditing={() => passwordInputRef.current?.focus()}
                      />
                    </Pressable>
                  </View>

                  {/* New Password Field */}
                  <View style={styles.inputField}>
                    <Pressable onPress={() => passwordInputRef.current?.focus()} hitSlop={6}>
                      <Text style={[styles.fieldLabel, { color: theme.mutedText }]}>NEW PASSWORD</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => passwordInputRef.current?.focus()}
                      style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <TextInput
                        ref={passwordInputRef}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Min 8 characters"
                        placeholderTextColor={theme.mutedText}
                        style={[styles.inputText, { color: theme.text }]}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        textContentType="newPassword"
                        returnKeyType="go"
                        onSubmitEditing={handleResetSubmit}
                      />
                      <Pressable
                        onPress={() => setShowPassword((v) => !v)}
                        hitSlop={12}
                        style={styles.eyeBtn}
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                        accessibilityState={{ selected: showPassword }}>
                        <EyeIcon size={20} color={theme.mutedText} off={!showPassword} />
                      </Pressable>
                    </Pressable>
                  </View>

                  {error ? <Text style={[styles.errorText, { color: theme.errorText }]}>{error}</Text> : null}

                  <Pressable
                    onPress={handleResetSubmit}
                    disabled={!canSubmitReset}
                    accessibilityRole="button"
                    accessibilityLabel="Reset password"
                    style={({ pressed }) => [
                      styles.submitBtn,
                      { backgroundColor: theme.brand, marginTop: 8 },
                      !canSubmitReset && { opacity: 0.5 },
                      pressed && canSubmitReset && { opacity: 0.85 },
                    ]}>
                    {busy ? (
                      <ActivityIndicator color={theme.brandText} />
                    ) : (
                      <Text style={[styles.submitText, { color: theme.brandText }]}>Reset password</Text>
                    )}
                  </Pressable>
                </>
              )}

              <View style={styles.linkGroup}>
                <Pressable onPress={() => switchMode('forgot')} hitSlop={8}>
                  <Text style={[styles.linkText, { color: theme.brand }]}>Request a new code</Text>
                </Pressable>
                <Pressable onPress={() => switchMode('login')} hitSlop={8}>
                  <Text style={[styles.linkText, { color: theme.mutedText }]}>Back to sign in</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

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
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
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
  forgotRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  linkGroup: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
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
