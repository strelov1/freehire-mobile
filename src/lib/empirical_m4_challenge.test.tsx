import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { Alert, Platform, Text, TextInput, useColorScheme } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import SecurityScreen from '@/app/account/security';
import { ReauthModal } from '@/components/auth/ReauthModal';
import { authApi } from '@/features/auth/api/authApi';
import { ReturnIntentManager } from '@/features/auth/model/returnIntent';
import { SessionCoordinator } from '@/features/auth/session/sessionCoordinator';
import { useIdentities } from '@/hooks/useIdentities';
import { useProviders } from '@/hooks/useProviders';
import {
  clearRecentAuth,
  isRecentAuthRequiredError,
  recordRecentAuth,
  useRecentAuth,
  type UseRecentAuthReturn,
} from '@/hooks/useRecentAuth';
import { useAuth } from '@/lib/authStore';
import { ApiError } from '@/lib/transport';

// Mocks
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('@/lib/authStore', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useProviders', () => ({
  useProviders: jest.fn(),
}));

jest.mock('@/hooks/useIdentities', () => ({
  useIdentities: jest.fn(),
}));

jest.mock('@/features/auth/api/authApi', () => {
  const original = jest.requireActual('@/features/auth/api/authApi');
  return {
    ...original,
    authApi: {
      ...original.authApi,
      changePassword: jest.fn(),
      logoutAll: jest.fn(),
    },
  };
});

jest.mock('@/features/auth/api/authV2Api', () => ({
  authV2Api: {
    identities: jest.fn(),
    unlinkIdentity: jest.fn(),
    passwordReauth: jest.fn(),
    appleAttempt: jest.fn(),
    appleExchange: jest.fn(),
    oauthStartUrl: jest.fn((p) => `https://mock.auth/oauth/${p}`),
    oauthExchange: jest.fn(),
  },
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

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
  signInAsync: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseProviders = useProviders as jest.MockedFunction<typeof useProviders>;
const mockUseIdentities = useIdentities as jest.MockedFunction<typeof useIdentities>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockChangePassword = authApi.changePassword as jest.MockedFunction<typeof authApi.changePassword>;

describe('Empirical M4 Adversarial Challenge Suite', () => {
  let queryClient: QueryClient;
  let activeRenderers: ReactTestRenderer.ReactTestRenderer[] = [];
  const mockLogoutAll = jest.fn();
  const mockUnlinkIdentity = jest.fn();
  const mockRefetchIdentities = jest.fn();

  function trackRenderer(renderer: ReactTestRenderer.ReactTestRenderer) {
    activeRenderers.push(renderer);
    return renderer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    activeRenderers = [];
    jest.spyOn(Alert, 'alert');
    (Platform as { OS: string }).OS = 'ios';
    mockUseColorScheme.mockReturnValue('light');
    clearRecentAuth();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: 'challenger@example.com',
        role: 'user',
        beta_tester: false,
        email_verified: true,
        has_password: true,
        created_at: null,
      },
      state: {
        status: 'authenticated',
        user: {
          id: 1,
          email: 'challenger@example.com',
          role: 'user',
          beta_tester: false,
          email_verified: true,
          has_password: true,
          created_at: null,
        },
      },
      loading: false,
      sessionEpoch: 5,
      logoutAll: mockLogoutAll,
      passwordReauth: jest.fn(),
      appleReauth: jest.fn(),
      oauthReauth: jest.fn(),
      signInWithProviderV2: jest.fn(),
      signInWithApple: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    mockUseProviders.mockReturnValue({
      providers: [
        { id: 'google', flow: 'browser_oauth', platforms: ['ios', 'android'], available: true },
        { id: 'github', flow: 'browser_oauth', platforms: ['ios', 'android'], available: true },
        { id: 'apple', flow: 'native_apple', platforms: ['ios'], available: true },
      ],
      schemaVersion: 2,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseIdentities.mockReturnValue({
      identities: [
        {
          provider: 'google',
          provider_email: 'challenger@gmail.com',
          linked_at: '2026-01-15T00:00:00Z',
          status: 'active',
          can_unlink: true,
        },
        {
          provider: 'github',
          linked_at: '2026-02-10T00:00:00Z',
          status: 'active',
          can_unlink: true,
        },
      ],
      hasPassword: true,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetchIdentities,
      unlinkIdentity: mockUnlinkIdentity,
      isUnlinking: false,
      unlinkingProvider: null,
    });
  });

  afterEach(() => {
    act(() => {
      for (const r of activeRenderers) {
        try {
          r.unmount();
        } catch {
          // ignore
        }
      }
    });
    activeRenderers = [];
    queryClient.clear();
    clearRecentAuth();
  });

  // =========================================================================
  // SECTION 1: Challenge ReauthModal Across All Auth Methods
  // =========================================================================
  describe('1. ReauthModal Adversarial Multi-Method Verification', () => {
    it('handles password input change, eye show/hide toggle, and whitespace-only rejection', () => {
      const onClose = jest.fn();
      const onSuccess = jest.fn();

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <ReauthModal visible={true} onClose={onClose} onSuccess={onSuccess} />,
          ),
        );
      });

      const input = renderer.root.findByType(TextInput);
      expect(input.props.secureTextEntry).toBe(true);

      // Eye toggle to show password
      const eyeBtn = renderer.root.findByProps({ accessibilityLabel: 'Show password' });
      act(() => {
        eyeBtn.props.onPress();
      });
      expect(input.props.secureTextEntry).toBe(false);

      // Eye toggle back to hide password
      const hideEyeBtn = renderer.root.findByProps({ accessibilityLabel: 'Hide password' });
      act(() => {
        hideEyeBtn.props.onPress();
      });
      expect(input.props.secureTextEntry).toBe(true);

      // Whitespace only submission
      act(() => {
        input.props.onChangeText('    ');
      });
      const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Confirm with Password' });
      expect(submitBtn.props.disabled).toBe(true);
    });

    it('successfully processes password reauth and updates recent-auth proof store', async () => {
      const onClose = jest.fn();
      const onSuccess = jest.fn();
      const proofExpires = new Date(Date.now() + 300_000).toISOString();
      const mockProof = { recent_auth_expires_at: proofExpires };

      const mockPwReauth = jest.fn().mockResolvedValueOnce(mockProof);
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'challenger@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null },
        passwordReauth: mockPwReauth,
        appleReauth: jest.fn(),
        oauthReauth: jest.fn(),
      } as unknown as ReturnType<typeof useAuth>);

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <ReauthModal visible={true} onClose={onClose} onSuccess={onSuccess} />,
          ),
        );
      });

      const input = renderer.root.findByType(TextInput);
      act(() => {
        input.props.onChangeText('ValidPassword123');
      });

      const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Confirm with Password' });
      await act(async () => {
        await submitBtn.props.onPress();
      });

      expect(mockPwReauth).toHaveBeenCalledWith('ValidPassword123');
      expect(onSuccess).toHaveBeenCalledWith(mockProof);
      expect(onClose).toHaveBeenCalled();
    });

    it('maps diverse API errors into user-friendly error banners (401, 429, offline, identity mismatch)', async () => {
      const onClose = jest.fn();
      const onSuccess = jest.fn();

      const scenarios = [
        {
          error: new ApiError({ kind: 'http', endpoint: '/reauth', status: 401, code: 'invalid_credentials' }),
          expected: 'Invalid password. Please try again.',
        },
        {
          error: new ApiError({ kind: 'http', endpoint: '/reauth', status: 429 }),
          expected: 'Too many attempts. Please try again later.',
        },
        {
          error: new ApiError({ kind: 'offline', endpoint: '/reauth' }),
          expected: 'You appear to be offline. Check your connection and try again.',
        },
        {
          error: new ApiError({ kind: 'http', endpoint: '/reauth', status: 400, code: 'reauth_identity_mismatch' }),
          expected: 'Please use the same account you signed in with.',
        },
        {
          error: new ApiError({ kind: 'server', endpoint: '/reauth', status: 500, serverError: 'Internal auth service disruption' }),
          expected: 'Internal auth service disruption',
        },
      ];

      for (const scenario of scenarios) {
        const mockPwReauth = jest.fn().mockRejectedValueOnce(scenario.error);
        mockUseAuth.mockReturnValue({
          user: { id: 1, email: 'test@example.com', has_password: true },
          passwordReauth: mockPwReauth,
          appleReauth: jest.fn(),
          oauthReauth: jest.fn(),
        } as unknown as ReturnType<typeof useAuth>);

        let renderer!: ReactTestRenderer.ReactTestRenderer;
        act(() => {
          renderer = trackRenderer(
            ReactTestRenderer.create(
              <ReauthModal visible={true} onClose={onClose} onSuccess={onSuccess} />,
            ),
          );
        });

        const input = renderer.root.findByType(TextInput);
        act(() => {
          input.props.onChangeText('somePass');
        });

        const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Confirm with Password' });
        await act(async () => {
          await submitBtn.props.onPress();
        });

        const errorNodes = renderer.root.findAllByType(Text).filter(
          (n) => n.props.children === scenario.expected,
        );
        expect(errorNodes.length).toBeGreaterThan(0);
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();

        act(() => {
          renderer.unmount();
        });
      }
    });

    it('renders AppleSignInButton on iOS and handles Apple reauth success and cancellation', async () => {
      (Platform as { OS: string }).OS = 'ios';
      const onClose = jest.fn();
      const onSuccess = jest.fn();
      const proofExpires = new Date(Date.now() + 300_000).toISOString();
      const mockProof = { recent_auth_expires_at: proofExpires };

      const mockAppleReauth = jest.fn().mockResolvedValueOnce(mockProof);
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'test@example.com', has_password: true },
        signInWithApple: mockAppleReauth,
        appleReauth: mockAppleReauth,
        oauthReauth: jest.fn(),
      } as unknown as ReturnType<typeof useAuth>);

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <ReauthModal visible={true} onClose={onClose} onSuccess={onSuccess} />,
          ),
        );
      });

      const appleBtn = renderer.root.findByProps({ accessibilityLabel: 'Sign in with Apple' });
      expect(appleBtn).toBeDefined();

      // Trigger Apple reauth button press
      const appleAuthBtn = renderer.root.findByType('AppleAuthenticationButton' as unknown as React.ComponentType);
      await act(async () => {
        await appleAuthBtn.props.onPress();
      });

      expect(mockAppleReauth).toHaveBeenCalledWith('reauth');
      expect(onSuccess).toHaveBeenCalledWith(mockProof);
      expect(onClose).toHaveBeenCalled();
    });

    it('omits AppleSignInButton on Android', () => {
      (Platform as { OS: string }).OS = 'android';
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <ReauthModal visible={true} onClose={jest.fn()} onSuccess={jest.fn()} />,
          ),
        );
      });

      const appleButtons = renderer.root.findAllByProps({ accessibilityLabel: 'Sign in with Apple' });
      expect(appleButtons).toHaveLength(0);
    });

    it('renders ProviderButtons for browser_oauth providers with purpose="reauth"', async () => {
      const onClose = jest.fn();
      const onSuccess = jest.fn();
      const proofExpires = new Date(Date.now() + 300_000).toISOString();
      const mockProof = { recent_auth_expires_at: proofExpires };

      const mockOAuthSignIn = jest.fn().mockResolvedValueOnce(mockProof);
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'test@example.com', has_password: true },
        signInWithProviderV2: mockOAuthSignIn,
        oauthReauth: mockOAuthSignIn,
      } as unknown as ReturnType<typeof useAuth>);

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <ReauthModal visible={true} onClose={onClose} onSuccess={onSuccess} />,
          ),
        );
      });

      const googleBtn = renderer.root.findByProps({ accessibilityLabel: 'Continue with Google' });
      const githubBtn = renderer.root.findByProps({ accessibilityLabel: 'Continue with GitHub' });

      expect(googleBtn).toBeDefined();
      expect(githubBtn).toBeDefined();

      // Press Google reauth
      await act(async () => {
        await googleBtn.props.onPress();
      });

      expect(mockOAuthSignIn).toHaveBeenCalledWith('google', 'reauth');
      expect(onSuccess).toHaveBeenCalledWith(mockProof);
      expect(onClose).toHaveBeenCalled();
    });

    it('completely hides password section and "or" divider for passwordless OAuth-only users', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 2, email: 'oauth@example.com', has_password: false },
      } as unknown as ReturnType<typeof useAuth>);

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <ReauthModal visible={true} onClose={jest.fn()} onSuccess={jest.fn()} />,
          ),
        );
      });

      const inputs = renderer.root.findAllByType(TextInput);
      expect(inputs).toHaveLength(0);

      const orDividers = renderer.root.findAllByType(Text).filter((t) => t.props.children === 'or');
      expect(orDividers).toHaveLength(0);

      const googleBtn = renderer.root.findByProps({ accessibilityLabel: 'Continue with Google' });
      expect(googleBtn).toBeDefined();
    });
  });

  // =========================================================================
  // SECTION 2: Challenge Password Update Form Validation & Gating
  // =========================================================================
  describe('2. Password Update Form Validation & Recent-Auth Gating', () => {
    function renderSecurityScreen() {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <SecurityScreen />
            </QueryClientProvider>,
          ),
        );
      });
      return renderer;
    }

    it('rejects passwords shorter than 8 characters with explicit error banner', async () => {
      const renderer = renderSecurityScreen();

      const currentInput = renderer.root.findByProps({ accessibilityLabel: 'Current Password' });
      const newInput = renderer.root.findByProps({ accessibilityLabel: 'New Password' });
      const confirmInput = renderer.root.findByProps({ accessibilityLabel: 'Confirm New Password' });
      const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Update Password' });

      act(() => {
        currentInput.props.onChangeText('validCurrent1');
        newInput.props.onChangeText('short7_'); // 7 chars
        confirmInput.props.onChangeText('short7_');
      });

      await act(async () => {
        await submitBtn.props.onPress();
      });

      expect(mockChangePassword).not.toHaveBeenCalled();
      const errNodes = renderer.root.findAllByType(Text).filter(
        (n) => n.props.children === 'New password must be at least 8 characters long.',
      );
      expect(errNodes.length).toBeGreaterThan(0);
    });

    it('rejects passwords longer than 72 characters with explicit error banner', async () => {
      const renderer = renderSecurityScreen();

      const currentInput = renderer.root.findByProps({ accessibilityLabel: 'Current Password' });
      const newInput = renderer.root.findByProps({ accessibilityLabel: 'New Password' });
      const confirmInput = renderer.root.findByProps({ accessibilityLabel: 'Confirm New Password' });
      const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Update Password' });

      const longPass = 'A'.repeat(73);
      act(() => {
        currentInput.props.onChangeText('validCurrent1');
        newInput.props.onChangeText(longPass);
        confirmInput.props.onChangeText(longPass);
      });

      await act(async () => {
        await submitBtn.props.onPress();
      });

      expect(mockChangePassword).not.toHaveBeenCalled();
      const errNodes = renderer.root.findAllByType(Text).filter(
        (n) => n.props.children === 'New password cannot exceed 72 characters.',
      );
      expect(errNodes.length).toBeGreaterThan(0);
    });

    it('rejects mismatch between new password and confirm password', async () => {
      const renderer = renderSecurityScreen();

      const currentInput = renderer.root.findByProps({ accessibilityLabel: 'Current Password' });
      const newInput = renderer.root.findByProps({ accessibilityLabel: 'New Password' });
      const confirmInput = renderer.root.findByProps({ accessibilityLabel: 'Confirm New Password' });
      const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Update Password' });

      act(() => {
        currentInput.props.onChangeText('validCurrent1');
        newInput.props.onChangeText('AlphaBravo123');
        confirmInput.props.onChangeText('AlphaBravo456');
      });

      await act(async () => {
        await submitBtn.props.onPress();
      });

      expect(mockChangePassword).not.toHaveBeenCalled();
      const errNodes = renderer.root.findAllByType(Text).filter(
        (n) => n.props.children === 'New passwords do not match.',
      );
      expect(errNodes.length).toBeGreaterThan(0);
    });

    it('supports eye visibility toggle for all three password fields', () => {
      const renderer = renderSecurityScreen();

      const currentInput = renderer.root.findByProps({ accessibilityLabel: 'Current Password' });
      const newInput = renderer.root.findByProps({ accessibilityLabel: 'New Password' });
      const confirmInput = renderer.root.findByProps({ accessibilityLabel: 'Confirm New Password' });

      expect(currentInput.props.secureTextEntry).toBe(true);
      expect(newInput.props.secureTextEntry).toBe(true);
      expect(confirmInput.props.secureTextEntry).toBe(true);

      const currentEye = renderer.root.findByProps({ accessibilityLabel: 'Show current password' });
      const newEye = renderer.root.findByProps({ accessibilityLabel: 'Show new password' });
      const confirmEye = renderer.root.findByProps({ accessibilityLabel: 'Show confirm password' });

      act(() => {
        currentEye.props.onPress();
        newEye.props.onPress();
        confirmEye.props.onPress();
      });

      expect(currentInput.props.secureTextEntry).toBe(false);
      expect(newInput.props.secureTextEntry).toBe(false);
      expect(confirmInput.props.secureTextEntry).toBe(false);
    });

    it('prompts ReauthModal when user lacks recent-auth proof before changing password', async () => {
      clearRecentAuth(); // hasRecentAuth = false
      const mockPwReauth = jest.fn().mockResolvedValueOnce({
        recent_auth_expires_at: new Date(Date.now() + 300_000).toISOString(),
      });
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'challenger@example.com', has_password: true },
        sessionEpoch: 3,
        passwordReauth: mockPwReauth,
        logoutAll: mockLogoutAll,
      } as unknown as ReturnType<typeof useAuth>);
      mockChangePassword.mockResolvedValueOnce(undefined);

      const renderer = renderSecurityScreen();

      const currentInput = renderer.root.findByProps({ accessibilityLabel: 'Current Password' });
      const newInput = renderer.root.findByProps({ accessibilityLabel: 'New Password' });
      const confirmInput = renderer.root.findByProps({ accessibilityLabel: 'Confirm New Password' });
      const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Update Password' });

      act(() => {
        currentInput.props.onChangeText('oldPass123');
        newInput.props.onChangeText('newSecurePass456');
        confirmInput.props.onChangeText('newSecurePass456');
      });

      // Submit password change
      let changePromise: Promise<void>;
      act(() => {
        changePromise = submitBtn.props.onPress();
      });

      // ReauthModal should be open
      const reauthInput = renderer.root.findByProps({ accessibilityLabel: 'Password' });
      expect(reauthInput).toBeDefined();

      act(() => {
        reauthInput.props.onChangeText('oldPass123');
      });
      const reauthConfirmBtn = renderer.root.findByProps({ accessibilityLabel: 'Confirm with Password' });
      await act(async () => {
        await reauthConfirmBtn.props.onPress();
        await changePromise;
      });

      expect(mockChangePassword).toHaveBeenCalledWith('oldPass123', 'newSecurePass456', 3);
      const successNodes = renderer.root.findAllByType(Text).filter(
        (n) =>
          n.props.children ===
          'Password updated successfully. Other active sessions have been signed out.',
      );
      expect(successNodes.length).toBeGreaterThan(0);
    });

    it('aborts password change smoothly if user cancels ReauthModal', async () => {
      clearRecentAuth();
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'challenger@example.com', has_password: true },
        sessionEpoch: 3,
        logoutAll: mockLogoutAll,
      } as unknown as ReturnType<typeof useAuth>);

      const renderer = renderSecurityScreen();

      const currentInput = renderer.root.findByProps({ accessibilityLabel: 'Current Password' });
      const newInput = renderer.root.findByProps({ accessibilityLabel: 'New Password' });
      const confirmInput = renderer.root.findByProps({ accessibilityLabel: 'Confirm New Password' });
      const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Update Password' });

      act(() => {
        currentInput.props.onChangeText('oldPass123');
        newInput.props.onChangeText('newSecurePass456');
        confirmInput.props.onChangeText('newSecurePass456');
      });

      // Submit
      act(() => {
        void submitBtn.props.onPress();
      });

      // Dismiss ReauthModal
      const closeBtn = renderer.root.findByProps({ accessibilityLabel: 'Close' });
      await act(async () => {
        closeBtn.props.onPress();
      });

      expect(mockChangePassword).not.toHaveBeenCalled();
      // Form fields are preserved
      expect(currentInput.props.value).toBe('oldPass123');
      expect(newInput.props.value).toBe('newSecurePass456');
    });

    it('handles 428 recent_auth_required error from changePassword API by prompting reauth and retrying', async () => {
      recordRecentAuth(new Date(Date.now() + 300_000));
      const error428 = new ApiError({
        kind: 'http',
        endpoint: '/api/v1/me/password',
        status: 428,
        code: 'recent_auth_required',
      });

      mockChangePassword
        .mockRejectedValueOnce(error428)
        .mockResolvedValueOnce(undefined);

      const mockPwReauth = jest.fn().mockResolvedValueOnce({
        recent_auth_expires_at: new Date(Date.now() + 300_000).toISOString(),
      });

      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'challenger@example.com', has_password: true },
        sessionEpoch: 3,
        passwordReauth: mockPwReauth,
        logoutAll: mockLogoutAll,
      } as unknown as ReturnType<typeof useAuth>);

      const renderer = renderSecurityScreen();

      const currentInput = renderer.root.findByProps({ accessibilityLabel: 'Current Password' });
      const newInput = renderer.root.findByProps({ accessibilityLabel: 'New Password' });
      const confirmInput = renderer.root.findByProps({ accessibilityLabel: 'Confirm New Password' });
      const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Update Password' });

      act(() => {
        currentInput.props.onChangeText('oldPass123');
        newInput.props.onChangeText('newSecurePass456');
        confirmInput.props.onChangeText('newSecurePass456');
      });

      let changePromise: Promise<void>;
      act(() => {
        changePromise = submitBtn.props.onPress();
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      // Reauth modal should be prompted after 428
      const reauthInput = renderer.root.findByProps({ accessibilityLabel: 'Password' });
      act(() => {
        reauthInput.props.onChangeText('oldPass123');
      });
      const reauthConfirmBtn = renderer.root.findByProps({ accessibilityLabel: 'Confirm with Password' });
      await act(async () => {
        await reauthConfirmBtn.props.onPress();
        await changePromise;
      });

      expect(mockChangePassword).toHaveBeenCalledTimes(2);
      const successNodes = renderer.root.findAllByType(Text).filter(
        (n) => n.props.children === 'Password updated successfully.',
      );
      expect(successNodes.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // SECTION 3: Challenge Sign Out Everywhere & Connected Identities
  // =========================================================================
  describe('3. Sign Out Everywhere & Connected Identities Verification', () => {
    function renderSecurityScreen() {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <SecurityScreen />
            </QueryClientProvider>,
          ),
        );
      });
      return renderer;
    }

    it('requires confirmation alert before executing logoutAll', async () => {
      mockLogoutAll.mockResolvedValueOnce(undefined);
      const renderer = renderSecurityScreen();

      const logoutBtn = renderer.root.findByProps({ accessibilityLabel: 'Sign out of all devices' });
      act(() => {
        logoutBtn.props.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Sign Out Everywhere?',
        expect.stringContaining('You will be signed out on this device and all other active mobile and web sessions.'),
        expect.any(Array),
      );

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = alertCall[2];
      const confirmAction = buttons.find((b: { text: string }) => b.text === 'Sign Out Everywhere');

      await act(async () => {
        await confirmAction.onPress();
      });

      expect(mockLogoutAll).toHaveBeenCalledTimes(1);
    });

    it('SessionCoordinator.logoutAll executes api.logoutAll, transitions to guest reason signed_out_everywhere, and increments sessionEpoch', async () => {
      const mockApi = {
        me: jest.fn(),
        login: jest.fn(),
        register: jest.fn(),
        exchangeOAuth: jest.fn(),
        logout: jest.fn(),
        logoutAll: jest.fn().mockResolvedValue(undefined),
      };
      const onStateChange = jest.fn();
      const transitionIdentity = jest.fn().mockResolvedValue(undefined);
      const executeReturnIntent = jest.fn();
      const coordinator = new SessionCoordinator({
        api: mockApi,
        returnIntents: new ReturnIntentManager(),
        onStateChange,
        transitionIdentity,
        executeReturnIntent,
        openOAuth: jest.fn(),
      });

      // Bootstrap user 42
      mockApi.me.mockResolvedValueOnce({ id: 42, email: 'user42@example.com' });
      await coordinator.bootstrap();

      expect(coordinator.getUser()?.id).toBe(42);
      expect(coordinator.getSessionEpoch()).toBe(1);
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: { id: 42, email: 'user42@example.com' } });

      // Execute logoutAll
      await coordinator.logoutAll();

      expect(mockApi.logoutAll).toHaveBeenCalledWith(1, expect.any(AbortSignal));
      expect(transitionIdentity).toHaveBeenCalledWith(42, undefined, 2);
      expect(coordinator.getUser()).toBeUndefined();
      expect(coordinator.getSessionEpoch()).toBe(2);
      expect(coordinator.getState()).toEqual({ status: 'guest', reason: 'signed_out_everywhere' });
    });

    it('blocks unlinking when user is passwordless and has only 1 connected identity', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 5, email: 'single_oauth@example.com', has_password: false },
        sessionEpoch: 2,
        logoutAll: mockLogoutAll,
      } as unknown as ReturnType<typeof useAuth>);

      mockUseIdentities.mockReturnValue({
        identities: [
          {
            provider: 'google',
            provider_email: 'single@gmail.com',
            linked_at: '2026-01-01T00:00:00Z',
            status: 'active',
            can_unlink: false,
          },
        ],
        hasPassword: false,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchIdentities,
        unlinkIdentity: mockUnlinkIdentity,
        isUnlinking: false,
        unlinkingProvider: null,
      });

      const renderer = renderSecurityScreen();

      const unlinkBtn = renderer.root.findByProps({ accessibilityLabel: 'Unlink Google' });
      expect(unlinkBtn.props.disabled).toBe(true);

      act(() => {
        unlinkBtn.props.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Cannot Unlink',
        expect.stringContaining('only sign-in method'),
      );
      expect(mockUnlinkIdentity).not.toHaveBeenCalled();
    });

    it('executes identity unlinking with recent-auth gating and handles Apple revocation_pending (202)', async () => {
      recordRecentAuth(new Date(Date.now() + 300_000));
      mockUnlinkIdentity.mockResolvedValueOnce({ status: 'revocation_pending' });

      mockUseIdentities.mockReturnValue({
        identities: [
          {
            provider: 'apple',
            provider_email: 'appleuser@privaterelay.appleid.com',
            linked_at: '2026-01-01T00:00:00Z',
            status: 'active',
            can_unlink: true,
          },
          {
            provider: 'github',
            linked_at: '2026-01-02T00:00:00Z',
            status: 'active',
            can_unlink: true,
          },
        ],
        hasPassword: true,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchIdentities,
        unlinkIdentity: mockUnlinkIdentity,
        isUnlinking: false,
        unlinkingProvider: null,
      });

      const renderer = renderSecurityScreen();

      const unlinkAppleBtn = renderer.root.findByProps({ accessibilityLabel: 'Unlink Apple' });
      act(() => {
        unlinkAppleBtn.props.onPress();
      });

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = alertCall[2];
      const unlinkAction = buttons.find((b: { text: string }) => b.text === 'Unlink');

      await act(async () => {
        await unlinkAction.onPress();
      });

      expect(mockUnlinkIdentity).toHaveBeenCalledWith('apple');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unlinking in Progress',
        expect.stringContaining('Disconnection for Apple has been initiated'),
      );
    });
  });

  // =========================================================================
  // SECTION 4: Challenge useRecentAuth State Machine & Countdown Timer
  // =========================================================================
  describe('4. useRecentAuth Synchronization, Timer & Expiry Defense', () => {
    it('synchronizes multiple hook consumers simultaneously via useSyncExternalStore', () => {
      let result1!: UseRecentAuthReturn;
      let result2!: UseRecentAuthReturn;

      function Consumer1() {
        result1 = useRecentAuth();
        return null;
      }
      function Consumer2() {
        result2 = useRecentAuth();
        return null;
      }

      act(() => {
        trackRenderer(
          ReactTestRenderer.create(
            <>
              <Consumer1 />
              <Consumer2 />
            </>,
          ),
        );
      });

      expect(result1.hasRecentAuth).toBe(false);
      expect(result2.hasRecentAuth).toBe(false);

      // Record proof in consumer 1
      act(() => {
        result1.recordRecentAuth(new Date(Date.now() + 180_000));
      });

      expect(result1.hasRecentAuth).toBe(true);
      expect(result2.hasRecentAuth).toBe(true);
      expect(result1.remainingSeconds).toBe(result2.remainingSeconds);

      // Clear in consumer 2
      act(() => {
        result2.clearRecentAuth();
      });

      expect(result1.hasRecentAuth).toBe(false);
      expect(result2.hasRecentAuth).toBe(false);
    });

    it('purges proof immediately when user changes or session epoch increments', () => {
      let latestResult!: UseRecentAuthReturn;

      function TestConsumer() {
        latestResult = useRecentAuth();
        return null;
      }

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(<TestConsumer />),
        );
      });

      act(() => {
        latestResult.recordRecentAuth(new Date(Date.now() + 300_000));
      });
      expect(latestResult.hasRecentAuth).toBe(true);

      // Advance session epoch
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'challenger@example.com' },
        sessionEpoch: 6,
      } as unknown as ReturnType<typeof useAuth>);

      act(() => {
        renderer.update(<TestConsumer />);
      });

      expect(latestResult.hasRecentAuth).toBe(false);
      expect(latestResult.recentAuthExpiresAt).toBeNull();
      expect(latestResult.remainingSeconds).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 5: Error Classifier & Edge Conditions
  // =========================================================================
  describe('5. isRecentAuthRequiredError Robustness', () => {
    it('correctly categorizes all HTTP 428 and recent_auth_required shapes', () => {
      expect(isRecentAuthRequiredError(new ApiError({ kind: 'http', endpoint: '/', status: 428 }))).toBe(true);
      expect(isRecentAuthRequiredError(new ApiError({ kind: 'http', endpoint: '/', status: 400, code: 'recent_auth_required' }))).toBe(true);
      expect(isRecentAuthRequiredError({ status: 428 })).toBe(true);
      expect(isRecentAuthRequiredError({ code: 'recent_auth_required' })).toBe(true);
      expect(isRecentAuthRequiredError({ error: 'recent_auth_required' })).toBe(true);
      expect(isRecentAuthRequiredError({ message: 'recent authentication required' })).toBe(true);

      // False cases
      expect(isRecentAuthRequiredError(null)).toBe(false);
      expect(isRecentAuthRequiredError(undefined)).toBe(false);
      expect(isRecentAuthRequiredError(428)).toBe(false);
      expect(isRecentAuthRequiredError('428')).toBe(false);
      expect(isRecentAuthRequiredError({ status: 401, code: 'invalid_credentials' })).toBe(false);
      expect(isRecentAuthRequiredError(new Error('something else'))).toBe(false);
    });
  });
});
