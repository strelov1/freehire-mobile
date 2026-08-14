import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Platform, Text, TextInput, useColorScheme } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import DeleteAccountScreen from '@/app/account/delete';
import { ReauthModal } from '@/components/auth/ReauthModal';
import { useProviders } from '@/hooks/useProviders';
import { useRecentAuth } from '@/hooks/useRecentAuth';
import { useAuth } from '@/lib/authStore';
import { ApiError } from '@/lib/transport';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: {
    AUTOMATIC: 'automatic',
  },
}));

jest.mock('@/lib/authStore', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useProviders', () => ({
  useProviders: jest.fn(),
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

describe('DeleteAccountScreen (src/app/account/delete.tsx)', () => {
  let queryClient: QueryClient;
  const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockedUseProviders = useProviders as jest.MockedFunction<typeof useProviders>;
  const mockedUseRecentAuth = useRecentAuth as jest.MockedFunction<typeof useRecentAuth>;
  const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
  const mockedOpenBrowserAsync = WebBrowser.openBrowserAsync as jest.MockedFunction<typeof WebBrowser.openBrowserAsync>;

  const mockDeleteAccount = jest.fn();
  const mockRetryBootstrap = jest.fn();
  const mockRecordReturnIntent = jest.fn();
  const mockRecordRecentAuth = jest.fn();
  const mockClearRecentAuth = jest.fn();

  function renderScreen() {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <DeleteAccountScreen />
        </QueryClientProvider>,
      );
    });
    return renderer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockedUseColorScheme.mockReturnValue('light');

    mockedUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: 'user@example.com',
        role: 'user',
        beta_tester: false,
        email_verified: true,
        has_password: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      state: { status: 'authenticated', user: { id: 1, email: 'user@example.com' } },
      sessionEpoch: 1,
      deleteAccount: mockDeleteAccount,
      retryBootstrap: mockRetryBootstrap,
      recordReturnIntent: mockRecordReturnIntent,
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseProviders.mockReturnValue({
      providers: [
        { id: 'google', flow: 'browser_oauth', platforms: ['ios', 'android'], available: true },
      ],
      schemaVersion: 2,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
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
    queryClient.clear();
  });

  it('renders title, permanence warning, subscription disclosure, email confirmation gate, and buttons', () => {
    const renderer = renderScreen();

    const root = renderer.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children).flat();

    expect(texts).toContain('Delete Account');
    expect(texts).toContain('Permanent Data Deletion');
    expect(texts).toContain('Active Subscriptions Notice');
    expect(texts).toContain('Confirm Account Email');
    expect(texts).toContain('Delete Account Permanently');
    expect(texts).toContain('Cancel');
  });

  it('navigates back when Back button or Cancel button is pressed', () => {
    const renderer = renderScreen();

    const backBtn = renderer.root.findByProps({ accessibilityLabel: 'Back' });
    act(() => {
      backBtn.props.onPress();
    });
    expect(router.back).toHaveBeenCalledTimes(1);

    const cancelBtn = renderer.root.findByProps({ accessibilityLabel: 'Cancel' });
    act(() => {
      cancelBtn.props.onPress();
    });
    expect(router.back).toHaveBeenCalledTimes(2);
  });

  it('opens subscription settings when Manage Subscriptions is pressed', async () => {
    const renderer = renderScreen();

    const manageBtn = renderer.root.findByProps({ accessibilityLabel: 'Manage Device Subscriptions' });
    await act(async () => {
      await manageBtn.props.onPress();
    });

    const expectedUrl = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';

    expect(mockedOpenBrowserAsync).toHaveBeenCalledWith(expectedUrl, expect.objectContaining({
      presentationStyle: 'automatic',
    }));
  });

  it('disables Delete button when email input is empty or mismatched, enables on exact match', () => {
    const renderer = renderScreen();

    const emailInput = renderer.root.findByType(TextInput);
    const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

    // Initially empty -> disabled
    expect(deleteBtn.props.disabled).toBe(true);

    // Mismatched email -> disabled
    act(() => {
      emailInput.props.onChangeText('wrong@example.com');
    });
    expect(deleteBtn.props.disabled).toBe(true);

    // Exact email match -> enabled
    act(() => {
      emailInput.props.onChangeText('user@example.com');
    });
    expect(deleteBtn.props.disabled).toBe(false);

    // Trimmed whitespace match -> enabled
    act(() => {
      emailInput.props.onChangeText('   user@example.com   ');
    });
    expect(deleteBtn.props.disabled).toBe(false);

    // Case-insensitive match -> enabled
    act(() => {
      emailInput.props.onChangeText('USER@EXAMPLE.COM');
    });
    expect(deleteBtn.props.disabled).toBe(false);
  });

  it('executes deletion directly when hasRecentAuth is true and navigates to / on success', async () => {
    mockDeleteAccount.mockResolvedValueOnce(undefined);
    const renderer = renderScreen();

    const emailInput = renderer.root.findByType(TextInput);
    const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

    act(() => {
      emailInput.props.onChangeText('user@example.com');
    });

    await act(async () => {
      await deleteBtn.props.onPress();
    });

    expect(mockDeleteAccount).toHaveBeenCalledWith('user@example.com');
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('prompts ReauthModal when hasRecentAuth is false before deletion', async () => {
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
    const renderer = renderScreen();

    const emailInput = renderer.root.findByType(TextInput);
    const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

    act(() => {
      emailInput.props.onChangeText('user@example.com');
    });

    // Tap delete button -> triggers reauth modal
    act(() => {
      deleteBtn.props.onPress();
    });

    const modal = renderer.root.findByType(ReauthModal);
    expect(modal.props.visible).toBe(true);
    expect(mockDeleteAccount).not.toHaveBeenCalled();

    // Simulate successful reauth
    await act(async () => {
      modal.props.onSuccess({ recent_auth_expires_at: '2026-08-14T20:00:00Z' });
    });

    expect(mockDeleteAccount).toHaveBeenCalledWith('user@example.com');
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('aborts deletion without calling API when ReauthModal is cancelled/dismissed', async () => {
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

    const renderer = renderScreen();

    const emailInput = renderer.root.findByType(TextInput);
    const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

    act(() => {
      emailInput.props.onChangeText('user@example.com');
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

    expect(modal.props.visible).toBe(false);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('catches HTTP 428 Precondition Required, triggers ReauthModal, and retries deletion', async () => {
    mockDeleteAccount
      .mockRejectedValueOnce(new ApiError({ kind: 'http', endpoint: '/api/v1/me', status: 428, code: 'recent_auth_required' }))
      .mockResolvedValueOnce(undefined);

    const renderer = renderScreen();

    const emailInput = renderer.root.findByType(TextInput);
    const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

    act(() => {
      emailInput.props.onChangeText('user@example.com');
    });

    await act(async () => {
      deleteBtn.props.onPress();
    });

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);

    const modal = renderer.root.findByType(ReauthModal);
    expect(modal.props.visible).toBe(true);

    // Complete reauth
    await act(async () => {
      modal.props.onSuccess({ recent_auth_expires_at: '2026-08-14T20:00:00Z' });
    });

    expect(mockDeleteAccount).toHaveBeenCalledTimes(2);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('displays 400 Bad Request error banner when email confirmation fails on server', async () => {
    mockDeleteAccount.mockRejectedValueOnce(
      new ApiError({ kind: 'http', endpoint: '/api/v1/me', status: 400 }),
    );

    const renderer = renderScreen();

    const emailInput = renderer.root.findByType(TextInput);
    const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

    act(() => {
      emailInput.props.onChangeText('user@example.com');
    });

    await act(async () => {
      await deleteBtn.props.onPress();
    });

    const errorTexts = renderer.root.findAllByType(Text).filter(
      (node) => node.props.children === 'Please confirm deletion by entering your exact account email.',
    );
    expect(errorTexts.length).toBeGreaterThan(0);
  });

  it('displays 503 Service Unavailable / storage outage error banner', async () => {
    mockDeleteAccount.mockRejectedValueOnce(
      new ApiError({ kind: 'server', endpoint: '/api/v1/me', status: 503, serverError: 'could not erase stored files' }),
    );

    const renderer = renderScreen();

    const emailInput = renderer.root.findByType(TextInput);
    const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

    act(() => {
      emailInput.props.onChangeText('user@example.com');
    });

    await act(async () => {
      await deleteBtn.props.onPress();
    });

    const errorTexts = renderer.root.findAllByType(Text).filter(
      (node) => node.props.children === 'Could not erase your stored files; nothing was deleted, please try again.',
    );
    expect(errorTexts.length).toBeGreaterThan(0);
  });

  it('displays offline error banner when device is offline', async () => {
    mockDeleteAccount.mockRejectedValueOnce(
      new ApiError({ kind: 'offline', endpoint: '/api/v1/me' }),
    );

    const renderer = renderScreen();

    const emailInput = renderer.root.findByType(TextInput);
    const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account Permanently' });

    act(() => {
      emailInput.props.onChangeText('user@example.com');
    });

    await act(async () => {
      await deleteBtn.props.onPress();
    });

    const errorTexts = renderer.root.findAllByType(Text).filter(
      (node) => node.props.children === 'You appear to be offline. Check your connection and try again.',
    );
    expect(errorTexts.length).toBeGreaterThan(0);
  });

  it('renders unauthenticated sign-in prompt when user is null', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      state: { status: 'guest', reason: 'no_session' },
      sessionEpoch: 0,
      deleteAccount: mockDeleteAccount,
      retryBootstrap: mockRetryBootstrap,
      recordReturnIntent: mockRecordReturnIntent,
    } as unknown as ReturnType<typeof useAuth>);

    const renderer = renderScreen();

    const texts = renderer.root.findAllByType(Text).map((t) => t.props.children).flat();
    expect(texts).toContain('Sign in to manage your account.');

    const signInBtn = renderer.root.findByProps({ accessibilityLabel: 'Sign in' });
    act(() => {
      signInBtn.props.onPress();
    });

    expect(mockRecordReturnIntent).toHaveBeenCalledWith({ kind: 'navigate', destination: 'account' });
    expect(router.push).toHaveBeenCalledWith('/auth');
  });

  it('renders unavailable state with retry action', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      state: { status: 'unavailable', kind: 'offline' },
      sessionEpoch: 0,
      deleteAccount: mockDeleteAccount,
      retryBootstrap: mockRetryBootstrap,
      recordReturnIntent: mockRecordReturnIntent,
    } as unknown as ReturnType<typeof useAuth>);

    const renderer = renderScreen();

    const texts = renderer.root.findAllByType(Text).map((t) => t.props.children).flat();
    expect(texts).toContain('Authentication service temporarily unavailable.');

    const retryBtn = renderer.root.findByProps({ accessibilityLabel: 'Retry' });
    act(() => {
      retryBtn.props.onPress();
    });

    expect(mockRetryBootstrap).toHaveBeenCalled();
  });
});
