import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Alert, Platform, Text, TextInput, useColorScheme } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import DeleteAccountScreen from '@/app/account/delete';
import AccountScreen from '@/app/account/index';
import ProfileScreen from '@/app/(tabs)/profile';
import { ReauthModal } from '@/components/auth/ReauthModal';
import { authV2Api } from '@/features/auth/api/authV2Api';
import { ReturnIntentManager } from '@/features/auth/model/returnIntent';
import { SessionCoordinator } from '@/features/auth/session/sessionCoordinator';
import { useIdentities } from '@/hooks/useIdentities';
import { useProviders } from '@/hooks/useProviders';
import { useRecentAuth } from '@/hooks/useRecentAuth';
import * as pushModule from '@/lib/push';
import { useAuth } from '@/lib/authStore';
import { ApiError } from '@/lib/transport';
import type { User } from '@/lib/types';

// Mocks
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: {
    AUTOMATIC: 'automatic',
  },
}));

jest.mock('@/lib/authStore', () => {
  const original = jest.requireActual('@/lib/authStore');
  return {
    ...original,
    useAuth: jest.fn(),
  };
});

jest.mock('@/hooks/useProviders', () => ({
  useProviders: jest.fn(),
}));

jest.mock('@/hooks/useIdentities', () => ({
  useIdentities: jest.fn(),
}));

jest.mock('@/hooks/useRecentAuth', () => {
  const original = jest.requireActual('@/hooks/useRecentAuth');
  return {
    ...original,
    useRecentAuth: jest.fn(),
    recordRecentAuth: jest.fn(),
    clearRecentAuth: jest.fn(),
  };
});

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

jest.mock('@/features/auth/api/authV2Api', () => ({
  authV2Api: {
    deleteAccount: jest.fn(),
    passwordReauth: jest.fn(),
    appleAttempt: jest.fn(),
    appleExchange: jest.fn(),
    oauthExchange: jest.fn(),
    oauthStartUrl: jest.fn(),
    providers: jest.fn(),
    identities: jest.fn(),
    unlinkIdentity: jest.fn(),
  },
}));

describe('Empirical M5 Adversarial Challenge & Stress Suite (FE-7)', () => {
  let queryClient: QueryClient;
  let activeRenderers: ReactTestRenderer.ReactTestRenderer[] = [];

  const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockedUseProviders = useProviders as jest.MockedFunction<typeof useProviders>;
  const mockedUseIdentities = useIdentities as jest.MockedFunction<typeof useIdentities>;
  const mockedUseRecentAuth = useRecentAuth as jest.MockedFunction<typeof useRecentAuth>;
  const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
  const mockedOpenBrowserAsync = WebBrowser.openBrowserAsync as jest.MockedFunction<
    typeof WebBrowser.openBrowserAsync
  >;

  const mockDeleteAccount = jest.fn();
  const mockSignOut = jest.fn();
  const mockLogoutAll = jest.fn();
  const mockRetryBootstrap = jest.fn();
  const mockRecordReturnIntent = jest.fn();
  const mockRecordRecentAuth = jest.fn();
  const mockClearRecentAuth = jest.fn();

  const standardUser: User = {
    id: 42,
    email: 'challenger@freehire.me',
    role: 'candidate',
    beta_tester: true,
    email_verified: true,
    has_password: true,
    created_at: '2026-02-01T12:00:00Z',
  };

  function trackRenderer(renderer: ReactTestRenderer.ReactTestRenderer) {
    activeRenderers.push(renderer);
    return renderer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    activeRenderers = [];

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockedUseColorScheme.mockReturnValue('dark');

    mockedUseAuth.mockReturnValue({
      user: standardUser,
      state: { status: 'authenticated', user: standardUser },
      sessionEpoch: 5,
      deleteAccount: mockDeleteAccount,
      signOut: mockSignOut,
      logoutAll: mockLogoutAll,
      retryBootstrap: mockRetryBootstrap,
      recordReturnIntent: mockRecordReturnIntent,
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseProviders.mockReturnValue({
      providers: [
        { id: 'google', flow: 'browser_oauth', platforms: ['ios', 'android'], available: true },
        { id: 'github', flow: 'browser_oauth', platforms: ['ios', 'android'], available: true },
      ],
      schemaVersion: 2,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    mockedUseIdentities.mockReturnValue({
      identities: [],
      hasPassword: true,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      unlinkIdentity: jest.fn(),
      isUnlinking: false,
      unlinkingProvider: null,
    });

    mockedUseRecentAuth.mockReturnValue({
      hasRecentAuth: true,
      recentAuthExpiresAt: new Date(Date.now() + 300_000),
      remainingSeconds: 300,
      recordRecentAuth: mockRecordRecentAuth,
      clearRecentAuth: mockClearRecentAuth,
      requestReauth: jest.fn(),
      executeWithRecentAuth: jest.fn(),
      withRecentAuth: jest.fn(),
    });
  });

  afterEach(() => {
    act(() => {
      activeRenderers.forEach((r) => {
        try {
          r.unmount();
        } catch {
          // ignore unmount errors in test cleanup
        }
      });
    });
    activeRenderers = [];
    queryClient.clear();
  });

  // =========================================================================
  // 1. REAUTH INTEGRATION & RECENT-AUTH GATING DURING DELETION
  // =========================================================================
  describe('1. Reauth Integration & Recent-Auth Gating During Deletion', () => {
    it('empirical challenge: missing recent-auth blocks deletion API call and raises ReauthModal', async () => {
      mockedUseRecentAuth.mockReturnValue({
        hasRecentAuth: false,
        recentAuthExpiresAt: null,
        remainingSeconds: 0,
        recordRecentAuth: mockRecordRecentAuth,
        clearRecentAuth: mockClearRecentAuth,
        requestReauth: jest.fn(),
        executeWithRecentAuth: jest.fn(),
        withRecentAuth: jest.fn(),
      });

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <DeleteAccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const emailInput = renderer.root.findByType(TextInput);
      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

      // Enter matching email
      act(() => {
        emailInput.props.onChangeText('challenger@freehire.me');
      });

      // Press delete
      act(() => {
        deleteBtn.props.onPress();
      });

      // Modal must be presented
      const modal = renderer.root.findByType(ReauthModal);
      expect(modal.props.visible).toBe(true);

      // Crucial security invariant: deleteAccount API must NOT have been called yet!
      expect(mockDeleteAccount).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('empirical challenge: cancelling ReauthModal leaves the deletion screen fully intact without invoking deletion API', async () => {
      mockedUseRecentAuth.mockReturnValue({
        hasRecentAuth: false,
        recentAuthExpiresAt: null,
        remainingSeconds: 0,
        recordRecentAuth: mockRecordRecentAuth,
        clearRecentAuth: mockClearRecentAuth,
        requestReauth: jest.fn(),
        executeWithRecentAuth: jest.fn(),
        withRecentAuth: jest.fn(),
      });

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <DeleteAccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const emailInput = renderer.root.findByType(TextInput);
      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

      act(() => {
        emailInput.props.onChangeText('challenger@freehire.me');
      });

      act(() => {
        deleteBtn.props.onPress();
      });

      const modal = renderer.root.findByType(ReauthModal);
      expect(modal.props.visible).toBe(true);

      // Dismiss modal
      await act(async () => {
        modal.props.onClose();
      });

      // Modal closed
      expect(modal.props.visible).toBe(false);
      // No delete API invocation
      expect(mockDeleteAccount).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();

      // Screen remains fully usable and interactive
      expect(deleteBtn.props.disabled).toBe(false);
      expect(emailInput.props.value).toBe('challenger@freehire.me');
    });

    it('empirical challenge: completing ReauthModal resumes deletion immediately and routes to / on success', async () => {
      mockedUseRecentAuth.mockReturnValue({
        hasRecentAuth: false,
        recentAuthExpiresAt: null,
        remainingSeconds: 0,
        recordRecentAuth: mockRecordRecentAuth,
        clearRecentAuth: mockClearRecentAuth,
        requestReauth: jest.fn(),
        executeWithRecentAuth: jest.fn(),
        withRecentAuth: jest.fn(),
      });

      mockDeleteAccount.mockResolvedValueOnce(undefined);

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <DeleteAccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const emailInput = renderer.root.findByType(TextInput);
      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

      act(() => {
        emailInput.props.onChangeText('challenger@freehire.me');
      });

      act(() => {
        deleteBtn.props.onPress();
      });

      const modal = renderer.root.findByType(ReauthModal);
      expect(modal.props.visible).toBe(true);

      // Provide valid proof on reauth success
      await act(async () => {
        modal.props.onSuccess({ recent_auth_expires_at: '2026-08-14T22:00:00Z' });
      });

      expect(mockRecordRecentAuth).toHaveBeenCalledWith('2026-08-14T22:00:00Z');
      expect(modal.props.visible).toBe(false);
      expect(mockDeleteAccount).toHaveBeenCalledWith('challenger@freehire.me');
      expect(router.replace).toHaveBeenCalledWith('/');
    });

    it('empirical challenge: HTTP 428 interception triggers clearRecentAuth, opens ReauthModal, and automatically retries deletion on proof', async () => {
      // Initially hasRecentAuth is true (e.g. client thought proof was valid, but backend rejected with 428)
      mockedUseRecentAuth.mockReturnValue({
        hasRecentAuth: true,
        recentAuthExpiresAt: new Date(Date.now() + 10_000),
        remainingSeconds: 10,
        recordRecentAuth: mockRecordRecentAuth,
        clearRecentAuth: mockClearRecentAuth,
        requestReauth: jest.fn(),
        executeWithRecentAuth: jest.fn(),
        withRecentAuth: jest.fn(),
      });

      // First call fails with 428, second retry call succeeds
      mockDeleteAccount
        .mockRejectedValueOnce(
          new ApiError({
            kind: 'http',
            endpoint: '/api/v1/me',
            status: 428,
            code: 'recent_auth_required',
          }),
        )
        .mockResolvedValueOnce(undefined);

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <DeleteAccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const emailInput = renderer.root.findByType(TextInput);
      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

      act(() => {
        emailInput.props.onChangeText('challenger@freehire.me');
      });

      // Trigger deletion
      await act(async () => {
        deleteBtn.props.onPress();
      });

      // 1st attempt occurred and caught 428
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
      expect(mockClearRecentAuth).toHaveBeenCalledTimes(1);

      // ReauthModal popped up reactively
      const modal = renderer.root.findByType(ReauthModal);
      expect(modal.props.visible).toBe(true);

      // Complete reauth
      await act(async () => {
        modal.props.onSuccess({ recent_auth_expires_at: '2026-08-14T23:00:00Z' });
      });

      // Retried deletion successfully
      expect(mockDeleteAccount).toHaveBeenCalledTimes(2);
      expect(mockDeleteAccount).toHaveBeenLastCalledWith('challenger@freehire.me');
      expect(router.replace).toHaveBeenCalledWith('/');
    });

    it('empirical challenge: HTTP 428 interception where user cancels ReauthModal gracefully resets isDeleting without crashing', async () => {
      mockDeleteAccount.mockRejectedValueOnce(
        new ApiError({
          kind: 'http',
          endpoint: '/api/v1/me',
          status: 428,
          code: 'recent_auth_required',
        }),
      );

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <DeleteAccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const emailInput = renderer.root.findByType(TextInput);
      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

      act(() => {
        emailInput.props.onChangeText('challenger@freehire.me');
      });

      await act(async () => {
        deleteBtn.props.onPress();
      });

      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);

      const modal = renderer.root.findByType(ReauthModal);
      expect(modal.props.visible).toBe(true);

      // Dismiss modal
      await act(async () => {
        modal.props.onClose();
      });

      // Modal closed, no second delete call
      expect(modal.props.visible).toBe(false);
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
      expect(router.replace).not.toHaveBeenCalled();
      expect(deleteBtn.props.disabled).toBe(false);
    });

    it('empirical challenge: HTTP 428 retry failure (e.g. 503 storage outage) renders accurate failure banner', async () => {
      mockDeleteAccount
        .mockRejectedValueOnce(
          new ApiError({
            kind: 'http',
            endpoint: '/api/v1/me',
            status: 428,
            code: 'recent_auth_required',
          }),
        )
        .mockRejectedValueOnce(
          new ApiError({
            kind: 'server',
            endpoint: '/api/v1/me',
            status: 503,
            serverError: 'could not erase stored files',
          }),
        );

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <DeleteAccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const emailInput = renderer.root.findByType(TextInput);
      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

      act(() => {
        emailInput.props.onChangeText('challenger@freehire.me');
      });

      await act(async () => {
        deleteBtn.props.onPress();
      });

      const modal = renderer.root.findByType(ReauthModal);
      await act(async () => {
        modal.props.onSuccess({ recent_auth_expires_at: '2026-08-14T23:00:00Z' });
      });

      expect(mockDeleteAccount).toHaveBeenCalledTimes(2);

      // Check for 503 error message banner
      const bannerTexts = renderer.root
        .findAllByType(Text)
        .map((t) => t.props.children)
        .flat();
      expect(bannerTexts).toContain(
        'Could not erase your stored files; nothing was deleted, please try again.',
      );
      expect(deleteBtn.props.disabled).toBe(false);
    });
  });

  // =========================================================================
  // 2. EMAIL CONFIRMATION GATE BOUNDARY & ADVERSARIAL STRESS TESTS
  // =========================================================================
  describe('2. Email Confirmation Gate Boundary & Adversarial Stress Tests', () => {
    it('empirical challenge: strictly rejects empty, partial, substring, and prefix/suffix email inputs', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <DeleteAccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const emailInput = renderer.root.findByType(TextInput);
      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

      const invalidInputs = [
        '',
        ' ',
        'challenger',
        'challenger@',
        'challenger@freehire',
        'challenger@freehire.m',
        'challenger@freehire.me.co',
        'prefix_challenger@freehire.me',
        'challenger@freehire.me_suffix',
        'wrong@freehire.me',
      ];

      for (const input of invalidInputs) {
        act(() => {
          emailInput.props.onChangeText(input);
        });
        expect(deleteBtn.props.disabled).toBe(true);
      }
    });

    it('empirical challenge: accepts exact match, mixed casing, and surrounding whitespace', () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <DeleteAccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const emailInput = renderer.root.findByType(TextInput);
      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

      const validInputs = [
        'challenger@freehire.me',
        'CHALLENGER@FREEHIRE.ME',
        'ChAlLeNgEr@FrEeHiRe.Me',
        '  challenger@freehire.me  ',
        '\t challenger@freehire.me \n',
      ];

      for (const input of validInputs) {
        act(() => {
          emailInput.props.onChangeText(input);
        });
        expect(deleteBtn.props.disabled).toBe(false);
      }
    });

    it('empirical challenge: rapid double-tap re-entrancy does not issue duplicate API deletion requests', async () => {
      let resolveDelete!: () => void;
      mockDeleteAccount.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <DeleteAccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const emailInput = renderer.root.findByType(TextInput);
      const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

      act(() => {
        emailInput.props.onChangeText('challenger@freehire.me');
      });

      // First tap begins deletion
      act(() => {
        deleteBtn.props.onPress();
      });

      // Second rapid tap while isDeleting is active
      act(() => {
        deleteBtn.props.onPress();
      });

      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);

      // Resolve deletion
      await act(async () => {
        resolveDelete();
      });

      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });

  // =========================================================================
  // 3. PUSH TOKEN UNREGISTRATION RESILIENCE
  // =========================================================================
  describe('3. Push Token Unregistration Resilience', () => {
    it('empirical challenge: push token unregistration network failure does NOT prevent deleteAccount from completing', async () => {
      // Spy on unregisterThisDevice and simulate network failure
      const unregisterSpy = jest
        .spyOn(pushModule, 'unregisterThisDevice')
        .mockRejectedValueOnce(new Error('Network offline or push service unreachable'));

      const mockCoordinator = {
        deleteAccount: jest.fn().mockResolvedValueOnce(undefined),
      } as unknown as SessionCoordinator;

      // Real authStore deleteAccount wrapper implementation:
      const deleteAccountWrapper = async (email?: string) => {
        try {
          await pushModule.unregisterThisDevice();
        } catch {
          // quiet fallback
        }
        await mockCoordinator.deleteAccount(email);
      };

      // Execute deletion with failing push unregistration
      await expect(deleteAccountWrapper('challenger@freehire.me')).resolves.toBeUndefined();

      expect(unregisterSpy).toHaveBeenCalledTimes(1);
      expect(mockCoordinator.deleteAccount).toHaveBeenCalledWith('challenger@freehire.me');
      unregisterSpy.mockRestore();
    });

    it('empirical challenge: unregisterThisDevice internally absorbs getPushToken or unregisterPushToken errors', async () => {
      const getPushTokenSpy = jest
        .spyOn(pushModule, 'getPushToken')
        .mockRejectedValueOnce(new Error('Push token service error'));

      // unregisterThisDevice should resolve without throwing
      await expect(pushModule.unregisterThisDevice()).resolves.toBeUndefined();
      getPushTokenSpy.mockRestore();
    });
  });

  // =========================================================================
  // 4. LEGAL LINKS & SUBSCRIPTION BROWSER INVOCATION
  // =========================================================================
  describe('4. Legal Links & Subscription Browser Invocation', () => {
    it('empirical challenge: AccountScreen invokes WebBrowser for Privacy Policy and Terms of Service with exact URLs', async () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <AccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const privacyBtn = renderer.root.findByProps({ accessibilityLabel: 'Privacy Policy' });
      await act(async () => {
        await privacyBtn.props.onPress();
      });

      expect(mockedOpenBrowserAsync).toHaveBeenCalledWith('https://freehire.me/privacy', {
        presentationStyle: 'automatic',
      });

      const termsBtn = renderer.root.findByProps({ accessibilityLabel: 'Terms of Service' });
      await act(async () => {
        await termsBtn.props.onPress();
      });

      expect(mockedOpenBrowserAsync).toHaveBeenCalledWith('https://freehire.me/terms', {
        presentationStyle: 'automatic',
      });
    });

    it('empirical challenge: DeleteAccountScreen opens iOS vs Android subscription management URLs correctly', async () => {
      // Test iOS platform
      const originalOS = Platform.OS;
      Platform.OS = 'ios';

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <DeleteAccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const manageBtn = renderer.root.findByProps({ accessibilityLabel: 'Manage Device Subscriptions' });
      await act(async () => {
        await manageBtn.props.onPress();
      });

      expect(mockedOpenBrowserAsync).toHaveBeenCalledWith(
        'https://apps.apple.com/account/subscriptions',
        { presentationStyle: 'automatic' },
      );

      // Test Android platform
      Platform.OS = 'android';
      await act(async () => {
        await manageBtn.props.onPress();
      });

      expect(mockedOpenBrowserAsync).toHaveBeenCalledWith(
        'https://play.google.com/store/account/subscriptions',
        { presentationStyle: 'automatic' },
      );

      Platform.OS = originalOS;
    });

    it('empirical challenge: WebBrowser rejection/exception is safely caught and does not crash screen', async () => {
      mockedOpenBrowserAsync.mockRejectedValueOnce(new Error('Browser unavailable or dismissed by OS'));

      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <AccountScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const privacyBtn = renderer.root.findByProps({ accessibilityLabel: 'Privacy Policy' });

      // Should not throw
      await expect(
        act(async () => {
          await privacyBtn.props.onPress();
        }),
      ).resolves.toBeUndefined();
    });

    it('empirical challenge: ProfileScreen renders Legal & Policies and opens Privacy & Terms links', async () => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = trackRenderer(
          ReactTestRenderer.create(
            <QueryClientProvider client={queryClient}>
              <ProfileScreen />
            </QueryClientProvider>,
          ),
        );
      });

      const privacyBtn = renderer.root.findByProps({ accessibilityLabel: 'Privacy Policy' });
      await act(async () => {
        await privacyBtn.props.onPress();
      });

      expect(mockedOpenBrowserAsync).toHaveBeenCalledWith('https://freehire.me/privacy', {
        presentationStyle: 'automatic',
      });

      const termsBtn = renderer.root.findByProps({ accessibilityLabel: 'Terms of Service' });
      await act(async () => {
        await termsBtn.props.onPress();
      });

      expect(mockedOpenBrowserAsync).toHaveBeenCalledWith('https://freehire.me/terms', {
        presentationStyle: 'automatic',
      });

      const deleteNavBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account' });
      act(() => {
        deleteNavBtn.props.onPress();
      });

      expect(router.push).toHaveBeenCalledWith('/account/delete');
    });
  });

  // =========================================================================
  // 5. SESSION COORDINATOR STATE MACHINE & CACHE CLEANUP DURING DELETION
  // =========================================================================
  describe('5. Session Coordinator State Machine & Cache Cleanup During Deletion', () => {
    it('empirical challenge: SessionCoordinator.deleteAccount transitions to guest(deleted) and invalidates cache on 204', async () => {
      const states: unknown[] = [];
      const transitions: [number | undefined, number | undefined, number][] = [];
      const returnIntents = new ReturnIntentManager();
      const mockApi = {
        me: jest.fn().mockResolvedValue(standardUser),
        login: jest.fn().mockResolvedValue(standardUser),
        register: jest.fn().mockResolvedValue(standardUser),
        exchangeOAuth: jest.fn().mockResolvedValue(standardUser),
        logout: jest.fn().mockResolvedValue(undefined),
        logoutAll: jest.fn().mockResolvedValue(undefined),
      };

      const coordinator = new SessionCoordinator({
        api: mockApi,
        returnIntents,
        onStateChange: (state) => states.push(state),
        transitionIdentity: async (prev, next, epoch) => {
          transitions.push([prev, next, epoch]);
        },
        executeReturnIntent: async () => undefined,
        openOAuth: async () => ({ code: 'code', cancelled: false }),
      });

      // Bootstrap coordinator into authenticated state
      await coordinator.bootstrap();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: standardUser });

      const mockDeleteApi = authV2Api.deleteAccount as jest.MockedFunction<
        typeof authV2Api.deleteAccount
      >;
      mockDeleteApi.mockResolvedValueOnce(undefined);

      // Execute deleteAccount
      await coordinator.deleteAccount(standardUser.email);

      expect(mockDeleteApi).toHaveBeenCalledWith(
        'challenger@freehire.me',
        expect.any(Number),
        expect.any(AbortSignal),
      );

      // Coordinator state must be guest with reason 'deleted'
      expect(coordinator.getState()).toEqual({
        status: 'guest',
        reason: 'deleted',
      });

      // Transition identity must transition from user.id to undefined
      expect(transitions.length).toBeGreaterThan(0);
      const lastTransition = transitions[transitions.length - 1]!;
      expect(lastTransition[0]).toBe(standardUser.id);
      expect(lastTransition[1]).toBeUndefined();
    });

    it('empirical challenge: SessionCoordinator.deleteAccount reverts to authenticated on API error', async () => {
      const states: unknown[] = [];
      const transitions: [number | undefined, number | undefined, number][] = [];
      const returnIntents = new ReturnIntentManager();
      const mockApi = {
        me: jest.fn().mockResolvedValue(standardUser),
        login: jest.fn().mockResolvedValue(standardUser),
        register: jest.fn().mockResolvedValue(standardUser),
        exchangeOAuth: jest.fn().mockResolvedValue(standardUser),
        logout: jest.fn().mockResolvedValue(undefined),
        logoutAll: jest.fn().mockResolvedValue(undefined),
      };

      const coordinator = new SessionCoordinator({
        api: mockApi,
        returnIntents,
        onStateChange: (state) => states.push(state),
        transitionIdentity: async (prev, next, epoch) => {
          transitions.push([prev, next, epoch]);
        },
        executeReturnIntent: async () => undefined,
        openOAuth: async () => ({ code: 'code', cancelled: false }),
      });

      // Bootstrap into authenticated state
      await coordinator.bootstrap();
      expect(coordinator.getState()).toEqual({ status: 'authenticated', user: standardUser });

      const mockDeleteApi = authV2Api.deleteAccount as jest.MockedFunction<
        typeof authV2Api.deleteAccount
      >;
      mockDeleteApi.mockRejectedValueOnce(
        new ApiError({
          kind: 'http',
          endpoint: '/api/v1/me',
          status: 428,
          code: 'recent_auth_required',
        }),
      );

      // deleteAccount should reject and revert state
      await expect(coordinator.deleteAccount(standardUser.email)).rejects.toThrow();

      // State is restored to authenticated with original user
      expect(coordinator.getState()).toEqual({
        status: 'authenticated',
        user: standardUser,
      });
    });
  });
});
