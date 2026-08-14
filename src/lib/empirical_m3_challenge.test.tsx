import React from 'react';
import { Platform, Text, TextInput, useColorScheme } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';

import { authV2Api } from '@/features/auth/api/authV2Api';
import { authApi, authMessage } from '@/features/auth/api/authApi';
import { ApiError } from '@/lib/transport';
import { useProviders, type UseProvidersResult } from '@/hooks/useProviders';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import AuthScreen from '@/app/auth';
import ForgotPasswordScreen from '@/app/auth/forgot';
import ResetPasswordScreen from '@/app/auth/reset';
import { useAuth } from '@/lib/authStore';

// Mocks
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    replace: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('@/lib/authStore', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

jest.mock('@/features/auth/api/authV2Api', () => ({
  authV2Api: {
    providers: jest.fn(),
  },
}));

jest.mock('@/features/auth/api/authApi', () => {
  const original = jest.requireActual('@/features/auth/api/authApi');
  return {
    ...original,
    authApi: {
      ...original.authApi,
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
    },
  };
});

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: 'AppleAuthenticationButton',
  AppleAuthenticationButtonType: {
    SIGN_IN: 0,
    CONTINUE: 1,
    SIGN_UP: 2,
  },
  AppleAuthenticationButtonStyle: {
    WHITE: 0,
    WHITE_OUTLINE: 1,
    BLACK: 2,
  },
}));

const mockProvidersApi = authV2Api.providers as jest.MockedFunction<typeof authV2Api.providers>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;

function findPressableByText(root: ReactTestRenderer.ReactTestInstance, text: string) {
  const textNode = root.findAllByType(Text).find((t) => {
    const c = t.props.children;
    return (typeof c === 'string' && c.trim() === text.trim()) || (Array.isArray(c) && c.join('').trim() === text.trim());
  });
  if (!textNode) throw new Error(`Text "${text}" not found`);
  let current: ReactTestRenderer.ReactTestInstance | null = textNode;
  while (current) {
    if (typeof current.props.onPress === 'function') {
      return current;
    }
    current = current.parent;
  }
  throw new Error(`Pressable ancestor for text "${text}" not found`);
}

describe('Empirical M3 Adversarial Challenge Suite', () => {
  let queryClient: QueryClient;
  const mockSignIn = jest.fn();
  const mockSignUp = jest.fn();
  const mockSignInWithProviderV2 = jest.fn();
  const mockSignInWithApple = jest.fn();
  const mockClearReturnIntent = jest.fn();
  const mockRetryReturnIntent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'ios';
    mockUseColorScheme.mockReturnValue('light');
    mockUseLocalSearchParams.mockReturnValue({});
    mockProvidersApi.mockResolvedValue({
      schema_version: 2,
      providers: [
        { id: 'google', flow: 'browser_oauth', platforms: ['ios', 'android'], available: true },
        { id: 'apple', flow: 'native_apple', platforms: ['ios'], available: true },
      ],
    });
    mockUseAuth.mockReturnValue({
      state: { status: 'guest', reason: 'no_session' },
      user: null,
      loading: false,
      sessionEpoch: 0,
      returnIntent: { status: 'empty' },
      signIn: mockSignIn,
      signUp: mockSignUp,
      signInWithProvider: jest.fn(),
      signInWithProviderV2: mockSignInWithProviderV2,
      signInWithApple: mockSignInWithApple,
      passwordReauth: jest.fn(),
      appleReauth: jest.fn(),
      oauthReauth: jest.fn(),
      deleteAccount: jest.fn(),
      signOut: jest.fn(),
      logoutAll: jest.fn(),
      retryBootstrap: jest.fn(),
      revalidate: jest.fn(),
      recordReturnIntent: jest.fn(),
      clearReturnIntent: mockClearReturnIntent,
      retryReturnIntent: mockRetryReturnIntent,
      isOwnerCurrent: jest.fn(),
      createPrivateMutation: jest.fn(),
    });
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retryDelay: 0,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  // =========================================================================
  // SECTION 1: Provider Discovery Failure & Degradation Resilience
  // =========================================================================
  describe('1. Provider Discovery Failure & Degradation Resilience', () => {
    async function renderProvidersHook(callback: (res: UseProvidersResult) => void) {
      function TestHookConsumer() {
        const res = useProviders();
        React.useEffect(() => {
          callback(res);
        }, [res]);
        return null;
      }

      let renderer: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        renderer = ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <TestHookConsumer />
          </QueryClientProvider>,
        );
      });

      return () => {
        act(() => {
          renderer.unmount();
        });
      };
    }

    it('recovers gracefully from HTTP 500 error, returning empty providers array without breaking', async () => {
      const serverErr = new ApiError({ kind: 'server', endpoint: '/api/v2/auth/providers', status: 500 });
      mockProvidersApi.mockRejectedValue(serverErr);

      let result: UseProvidersResult | null = null;
      const unmount = await renderProvidersHook((res) => {
        result = res;
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 80));
      });

      expect(result).not.toBeNull();
      expect(result!.isLoading).toBe(false);
      expect(result!.isError).toBe(true);
      expect(result!.providers).toEqual([]);
      expect(result!.schemaVersion).toBe(2);
      expect((result!.error as ApiError).status).toBe(500);

      unmount();
    });

    it('recovers gracefully from network offline error, returning empty providers array', async () => {
      mockProvidersApi.mockRejectedValue(
        new ApiError({ kind: 'offline', endpoint: '/api/v2/auth/providers' }),
      );

      let result: UseProvidersResult | null = null;
      const unmount = await renderProvidersHook((res) => {
        result = res;
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      expect(result).not.toBeNull();
      expect(result!.isError).toBe(true);
      expect(result!.providers).toEqual([]);

      unmount();
    });

    it('recovers gracefully from network timeout error, returning empty providers array', async () => {
      mockProvidersApi.mockRejectedValue(
        new ApiError({ kind: 'timeout', endpoint: '/api/v2/auth/providers' }),
      );

      let result: UseProvidersResult | null = null;
      const unmount = await renderProvidersHook((res) => {
        result = res;
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      expect(result).not.toBeNull();
      expect(result!.isError).toBe(true);
      expect(result!.providers).toEqual([]);

      unmount();
    });

    it('correctly filters providers by platform (ios vs android vs web)', async () => {
      (Platform as { OS: string }).OS = 'web';
      mockProvidersApi.mockResolvedValueOnce({
        schema_version: 2,
        providers: [
          { id: 'all_empty', flow: 'browser_oauth', platforms: [], available: true },
          { id: 'web_only', flow: 'browser_oauth', platforms: ['web'], available: true },
          { id: 'ios_only', flow: 'native_apple', platforms: ['ios'], available: true },
          { id: 'android_only', flow: 'browser_oauth', platforms: ['android'], available: true },
          { id: 'multi_platform', flow: 'browser_oauth', platforms: ['ios', 'web'], available: true },
        ],
      });

      let result: UseProvidersResult | null = null;
      const unmount = await renderProvidersHook((res) => {
        result = res;
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      expect(result).not.toBeNull();
      const ids = result!.providers.map((p) => p.id);
      expect(ids).toEqual(['all_empty', 'web_only', 'multi_platform']);
      expect(ids).not.toContain('ios_only');
      expect(ids).not.toContain('android_only');

      unmount();
    });

    it('AuthScreen allows email/password sign in when providers query fails completely', async () => {
      mockProvidersApi.mockRejectedValue(
        new ApiError({ kind: 'server', endpoint: '/api/v2/auth/providers', status: 500 }),
      );
      mockSignIn.mockResolvedValueOnce({ status: 'success', intent: 'none' });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <AuthScreen />
          </QueryClientProvider>,
        );
      });

      const inputs = renderer!.root.findAllByType(TextInput);
      expect(inputs.length).toBeGreaterThanOrEqual(2);
      const emailInput = inputs[0]!;
      const passwordInput = inputs[1]!;

      act(() => {
        emailInput.props.onChangeText('testuser@domain.com');
        passwordInput.props.onChangeText('validpassword');
      });

      const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Log in' });
      await act(async () => {
        await submitBtn.props.onPress();
      });

      expect(mockSignIn).toHaveBeenCalledWith('testuser@domain.com', 'validpassword');
      expect(router.back).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SECTION 2: Apple Sign-In Sheet Cancellation Absorption & HIG Conformance
  // =========================================================================
  describe('2. Apple Sign-In Sheet Cancellation & HIG Conformance', () => {
    it('strictly renders null on non-iOS platforms (Android, Web, Windows)', () => {
      const nonIosPlatforms = ['android', 'web', 'windows'];
      for (const os of nonIosPlatforms) {
        (Platform as { OS: string }).OS = os;
        let renderer: ReactTestRenderer.ReactTestRenderer;
        act(() => {
          renderer = ReactTestRenderer.create(<AppleSignInButton />);
        });
        expect(renderer!.toJSON()).toBeNull();
      }
    });

    it('silently absorbs user cancellation (code 1001 / cancelled) without triggering onError or alerts', async () => {
      (Platform as { OS: string }).OS = 'ios';
      const onSuccess = jest.fn();
      const onError = jest.fn();
      mockSignInWithApple.mockResolvedValueOnce({ status: 'cancelled', intent: 'none' });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <AppleSignInButton onSuccess={onSuccess} onError={onError} />,
        );
      });

      const btn = renderer!.root.findByType('AppleAuthenticationButton' as unknown as React.ComponentType);
      await act(async () => {
        await btn.props.onPress();
      });

      expect(mockSignInWithApple).toHaveBeenCalledWith('sign_in');
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('adapts HIG style dynamically: BLACK in light mode and WHITE in dark mode', () => {
      (Platform as { OS: string }).OS = 'ios';

      // Light mode -> BLACK
      mockUseColorScheme.mockReturnValue('light');
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<AppleSignInButton />);
      });
      let btn = renderer!.root.findByType('AppleAuthenticationButton' as unknown as React.ComponentType);
      expect(btn.props.buttonStyle).toBe(AppleAuthentication.AppleAuthenticationButtonStyle.BLACK);
      expect(btn.props.cornerRadius).toBe(100);

      // Dark mode -> WHITE
      mockUseColorScheme.mockReturnValue('dark');
      act(() => {
        renderer = ReactTestRenderer.create(<AppleSignInButton />);
      });
      btn = renderer!.root.findByType('AppleAuthenticationButton' as unknown as React.ComponentType);
      expect(btn.props.buttonStyle).toBe(AppleAuthentication.AppleAuthenticationButtonStyle.WHITE);
    });

    it('prevents concurrent double-taps while press is in flight', async () => {
      (Platform as { OS: string }).OS = 'ios';
      let resolveApple!: (val: any) => void;
      const slowApplePromise = new Promise((resolve) => {
        resolveApple = resolve;
      });
      mockSignInWithApple.mockImplementationOnce(() => slowApplePromise);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<AppleSignInButton />);
      });

      const btn = renderer!.root.findByType('AppleAuthenticationButton' as unknown as React.ComponentType);

      // First tap
      let p1: Promise<void>;
      act(() => {
        p1 = btn.props.onPress();
      });

      // Second tap while busy
      await act(async () => {
        await btn.props.onPress();
      });

      expect(mockSignInWithApple).toHaveBeenCalledTimes(1);

      // Resolve first tap
      await act(async () => {
        resolveApple({ status: 'success', intent: 'none' });
        await p1;
      });

      expect(mockSignInWithApple).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // SECTION 3: Mode Switching State Machine & ReturnIntent Preservation
  // =========================================================================
  describe('3. Mode Switching State Machine & ReturnIntent Preservation', () => {
    it('clears transient error banner when switching between login and register modes', async () => {
      mockSignIn.mockRejectedValueOnce(
        new ApiError({ kind: 'http', endpoint: '/login', status: 401 }),
      );

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <AuthScreen />
          </QueryClientProvider>,
        );
      });

      const inputs = renderer!.root.findAllByType(TextInput);
      const emailInput = inputs[0]!;
      const passwordInput = inputs[1]!;

      act(() => {
        emailInput.props.onChangeText('test@example.com');
        passwordInput.props.onChangeText('wrongpassword');
      });

      const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Log in' });
      await act(async () => {
        await submitBtn.props.onPress();
      });

      // Error banner should be visible
      let textNodes = renderer!.root.findAllByType(Text);
      let errNode = textNodes.find((t) => t.props.children === 'Invalid email or password.');
      expect(errNode).toBeDefined();

      // Switch to Register mode
      const tabs = renderer!.root
        .findAllByProps({ accessibilityRole: 'tab' })
        .filter((node) => typeof node.props.onPress === 'function');
      const registerTab = tabs[1]!;

      act(() => {
        registerTab.props.onPress();
      });

      // Error banner should be cleared
      textNodes = renderer!.root.findAllByType(Text);
      errNode = textNodes.find((t) => t.props.children === 'Invalid email or password.');
      expect(errNode).toBeUndefined();

      // returnIntent should NOT be cleared by mode switch
      expect(mockClearReturnIntent).not.toHaveBeenCalled();
    });

    it('preserves returnIntent across mode switches (login -> forgot -> reset)', () => {
      mockUseAuth.mockReturnValue({
        state: { status: 'guest', reason: 'no_session' },
        user: null,
        loading: false,
        sessionEpoch: 0,
        returnIntent: { status: 'pending', intent: { kind: 'navigate', destination: 'account' } },
        signIn: mockSignIn,
        signUp: mockSignUp,
        signInWithProvider: jest.fn(),
        signInWithProviderV2: mockSignInWithProviderV2,
        signInWithApple: mockSignInWithApple,
        passwordReauth: jest.fn(),
        appleReauth: jest.fn(),
        oauthReauth: jest.fn(),
        deleteAccount: jest.fn(),
        signOut: jest.fn(),
        logoutAll: jest.fn(),
        retryBootstrap: jest.fn(),
        revalidate: jest.fn(),
        recordReturnIntent: jest.fn(),
        clearReturnIntent: mockClearReturnIntent,
        retryReturnIntent: mockRetryReturnIntent,
        isOwnerCurrent: jest.fn(),
        createPrivateMutation: jest.fn(),
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <AuthScreen />
          </QueryClientProvider>,
        );
      });

      // Find "Forgot password?" pressable
      const forgotPressable = findPressableByText(renderer!.root, 'Forgot password?');
      act(() => {
        forgotPressable.props.onPress();
      });

      // Verify in forgot mode
      const titleForgot = renderer!.root.findAllByType(Text).find((t) => t.props.children === 'Forgot password');
      expect(titleForgot).toBeDefined();
      expect(mockClearReturnIntent).not.toHaveBeenCalled();

      // Go to reset mode via "I already have a reset code"
      const resetPressable = findPressableByText(renderer!.root, 'I already have a reset code');
      act(() => {
        resetPressable.props.onPress();
      });

      // Verify in reset mode
      const titleReset = renderer!.root.findAllByType(Text).find((t) => t.props.children === 'Reset password');
      expect(titleReset).toBeDefined();
      expect(mockClearReturnIntent).not.toHaveBeenCalled();
    });

    it('explicitly clears returnIntent when user dismisses the auth modal via close button', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <AuthScreen />
          </QueryClientProvider>,
        );
      });

      const closeBtn = renderer!.root.findByProps({ accessibilityLabel: 'Close auth sheet' });
      act(() => {
        closeBtn.props.onPress();
      });

      expect(mockClearReturnIntent).toHaveBeenCalledTimes(1);
      expect(router.back).toHaveBeenCalled();
    });

    it('renders return intent failure state when authenticated with failed action', async () => {
      mockUseAuth.mockReturnValue({
        state: { status: 'authenticated', user: { id: 1, email: 'a@b.com' } as any },
        user: { id: 1, email: 'a@b.com' } as any,
        loading: false,
        sessionEpoch: 1,
        returnIntent: { status: 'failed', intent: { kind: 'navigate', destination: 'account' } },
        signIn: mockSignIn,
        signUp: mockSignUp,
        signInWithProvider: jest.fn(),
        signInWithProviderV2: mockSignInWithProviderV2,
        signInWithApple: mockSignInWithApple,
        passwordReauth: jest.fn(),
        appleReauth: jest.fn(),
        oauthReauth: jest.fn(),
        deleteAccount: jest.fn(),
        signOut: jest.fn(),
        logoutAll: jest.fn(),
        retryBootstrap: jest.fn(),
        revalidate: jest.fn(),
        recordReturnIntent: jest.fn(),
        clearReturnIntent: mockClearReturnIntent,
        retryReturnIntent: mockRetryReturnIntent,
        isOwnerCurrent: jest.fn(),
        createPrivateMutation: jest.fn(),
      });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <AuthScreen />
          </QueryClientProvider>,
        );
      });

      const textNodes = renderer!.root.findAllByType(Text);
      const failedMsg = textNodes.find((t) =>
        typeof t.props.children === 'string' && t.props.children.includes('requested action failed'),
      );
      expect(failedMsg).toBeDefined();

      const retryPressable = findPressableByText(renderer!.root, 'Retry action');
      await act(async () => {
        await retryPressable.props.onPress();
      });

      expect(mockRetryReturnIntent).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SECTION 4: Password Reset Constraints & Validation Hardening
  // =========================================================================
  describe('4. Password Reset Constraints & Validation Hardening', () => {
    it('auth.tsx reset mode enforces minimum 8 characters for password submission', () => {
      mockUseLocalSearchParams.mockReturnValue({ mode: 'reset', email: 'test@example.com', code: '123456' });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <AuthScreen />
          </QueryClientProvider>,
        );
      });

      const inputs = renderer!.root.findAllByType(TextInput);
      expect(inputs.length).toBeGreaterThanOrEqual(3);
      const passwordInput = inputs[inputs.length - 1]!;

      // Enter 7 chars -> disabled
      act(() => {
        passwordInput.props.onChangeText('1234567');
      });

      const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Reset password' });
      expect(submitBtn.props.disabled).toBe(true);

      // Enter 8 chars -> enabled
      act(() => {
        passwordInput.props.onChangeText('12345678');
      });

      expect(submitBtn.props.disabled).toBe(false);
    });

    it('reset.tsx enforces minimum 8 characters for password submission', () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<ResetPasswordScreen />);
      });

      const inputs = renderer!.root.findAllByType(TextInput);
      const emailInput = inputs[0]!;
      const codeInput = inputs[1]!;
      const passwordInput = inputs[2]!;

      act(() => {
        emailInput.props.onChangeText('user@test.com');
        codeInput.props.onChangeText('123456');
        passwordInput.props.onChangeText('short12'); // 7 chars
      });

      const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Reset password' });
      expect(submitBtn.props.disabled).toBe(true);

      act(() => {
        passwordInput.props.onChangeText('validPassword8');
      });

      expect(submitBtn.props.disabled).toBe(false);
    });

    it('handles expired or invalid reset token error (401 / 404) with safe user copy', async () => {
      (authApi.resetPassword as jest.Mock).mockRejectedValueOnce(
        new ApiError({ kind: 'http', endpoint: '/reset', status: 401 }),
      );

      mockUseLocalSearchParams.mockReturnValue({ mode: 'reset', email: 'test@example.com', code: 'expired123' });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <AuthScreen />
          </QueryClientProvider>,
        );
      });

      const inputs = renderer!.root.findAllByType(TextInput);
      const passwordInput = inputs[inputs.length - 1]!;

      act(() => {
        passwordInput.props.onChangeText('newPassword123');
      });

      const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Reset password' });
      await act(async () => {
        await submitBtn.props.onPress();
      });

      const textNodes = renderer!.root.findAllByType(Text);
      const errNode = textNodes.find(
        (t) => t.props.children === 'Reset code is invalid or expired. Please request a new one.',
      );
      expect(errNode).toBeDefined();
    });
  });

  // =========================================================================
  // SECTION 5: Timing Oracle & Account Enumeration Defense in Forgot Password
  // =========================================================================
  describe('5. Timing Oracle & Account Enumeration Defense in Forgot Password', () => {
    it('returns generic confirmation without leaking account existence on 202 in auth.tsx', async () => {
      (authApi.forgotPassword as jest.Mock).mockResolvedValueOnce(undefined);
      mockUseLocalSearchParams.mockReturnValue({ mode: 'forgot' });

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <QueryClientProvider client={queryClient}>
            <AuthScreen />
          </QueryClientProvider>,
        );
      });

      const inputs = renderer!.root.findAllByType(TextInput);
      const emailInput = inputs[0]!;

      act(() => {
        emailInput.props.onChangeText('nonexistent@domain.com');
      });

      const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Send reset code' });
      await act(async () => {
        await submitBtn.props.onPress();
      });

      expect(authApi.forgotPassword).toHaveBeenCalledWith('nonexistent@domain.com');

      const textNodes = renderer!.root.findAllByType(Text);
      const confirmationNode = textNodes.find((t) => {
        const content = Array.isArray(t.props.children) ? t.props.children.join('') : t.props.children;
        return typeof content === 'string' && content.includes('Check your email');
      });
      expect(confirmationNode).toBeDefined();
    });

    it('returns generic confirmation without leaking account existence in forgot.tsx', async () => {
      (authApi.forgotPassword as jest.Mock).mockResolvedValueOnce(undefined);

      let renderer: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<ForgotPasswordScreen />);
      });

      const input = renderer!.root.findByType(TextInput);
      act(() => {
        input.props.onChangeText('someone@domain.com');
      });

      const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Send reset code' });
      await act(async () => {
        await submitBtn.props.onPress();
      });

      expect(authApi.forgotPassword).toHaveBeenCalledWith('someone@domain.com');

      const textNodes = renderer!.root.findAllByType(Text);
      const confirmationNode = textNodes.find((t) => {
        const content = Array.isArray(t.props.children) ? t.props.children.join('') : t.props.children;
        return typeof content === 'string' && content.includes('Check your email');
      });
      expect(confirmationNode).toBeDefined();
    });

    it('maps rate limit 429 errors cleanly to generic time-based message without leaking status', () => {
      const rateLimitErr = new ApiError({ kind: 'http', endpoint: '/forgot', status: 429, retryAfterSeconds: 120 });
      const msg = authMessage(rateLimitErr, 'forgot');
      expect(msg).toBe('Too many attempts. Try again in 2 minute(s).');
    });
  });
});
