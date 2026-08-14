import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Text, useColorScheme } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import SecurityScreen from '@/app/account/security';
import { authApi } from '@/features/auth/api/authApi';
import { useIdentities } from '@/hooks/useIdentities';
import { useProviders } from '@/hooks/useProviders';
import { useRecentAuth } from '@/hooks/useRecentAuth';
import { useAuth } from '@/lib/authStore';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('@/lib/authStore', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useIdentities', () => ({
  useIdentities: jest.fn(),
}));

jest.mock('@/hooks/useProviders', () => ({
  useProviders: jest.fn(),
}));

jest.mock('@/hooks/useRecentAuth', () => ({
  useRecentAuth: jest.fn(),
  recordRecentAuth: jest.fn(),
  clearRecentAuth: jest.fn(),
}));

jest.mock('@/features/auth/api/authApi', () => ({
  authApi: {
    changePassword: jest.fn(),
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
}));

describe('SecurityScreen (src/app/account/security.tsx)', () => {
  let queryClient: QueryClient;
  const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockedUseIdentities = useIdentities as jest.MockedFunction<typeof useIdentities>;
  const mockedUseProviders = useProviders as jest.MockedFunction<typeof useProviders>;
  const mockedUseRecentAuth = useRecentAuth as jest.MockedFunction<typeof useRecentAuth>;
  const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
  const mockedChangePassword = authApi.changePassword as jest.MockedFunction<typeof authApi.changePassword>;

  const mockLogoutAll = jest.fn();
  const mockUnlinkIdentity = jest.fn();
  const mockRefetchIdentities = jest.fn();
  const mockRecordRecentAuth = jest.fn();
  const mockClearRecentAuth = jest.fn();

  function renderScreen() {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <SecurityScreen />
        </QueryClientProvider>,
      );
    });
    return renderer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockedUseColorScheme.mockReturnValue('light');

    mockedUseAuth.mockReturnValue({
      user: { id: 1, email: 'user@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null },
      sessionEpoch: 2,
      logoutAll: mockLogoutAll,
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseProviders.mockReturnValue({
      providers: [
        { id: 'google', flow: 'browser_oauth', platforms: ['ios', 'android'], available: true },
        { id: 'apple', flow: 'native_apple', platforms: ['ios'], available: true },
      ],
      schemaVersion: 2,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    mockedUseIdentities.mockReturnValue({
      identities: [
        { provider: 'google', provider_email: 'user@gmail.com', linked_at: '2026-01-01T00:00:00Z', status: 'active', can_unlink: true },
        { provider: 'github', linked_at: '2026-02-01T00:00:00Z', status: 'active', can_unlink: true },
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

  it('renders header, password form, connected accounts, active sessions, and danger zone', () => {
    const renderer = renderScreen();

    const root = renderer.root;
    const titles = root.findAllByType(Text).filter((node) => typeof node.props.children === 'string');
    const titleTexts = titles.map((t) => t.props.children);

    expect(titleTexts).toContain('Security');
    expect(titleTexts).toContain('Password');
    expect(titleTexts).toContain('Connected Accounts');
    expect(titleTexts).toContain('Active Sessions');
    expect(titleTexts).toContain('Danger Zone');
  });

  it('handles navigation back button press', () => {
    const renderer = renderScreen();

    const backBtn = renderer.root.findByProps({ accessibilityLabel: 'Back' });
    act(() => {
      backBtn.props.onPress();
    });

    expect(router.back).toHaveBeenCalled();
  });

  it('validates password inputs and prevents submit if mismatched or too short', async () => {
    const renderer = renderScreen();

    const currentInput = renderer.root.findByProps({ accessibilityLabel: 'Current Password' });
    const newInput = renderer.root.findByProps({ accessibilityLabel: 'New Password' });
    const confirmInput = renderer.root.findByProps({ accessibilityLabel: 'Confirm New Password' });
    const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Update Password' });

    act(() => {
      currentInput.props.onChangeText('oldPassword123');
      newInput.props.onChangeText('short');
      confirmInput.props.onChangeText('short');
    });

    await act(async () => {
      await submitBtn.props.onPress();
    });

    expect(mockedChangePassword).not.toHaveBeenCalled();
    const errorText = renderer.root.findAllByType(Text).filter(
      (node) => node.props.children === 'New password must be at least 8 characters long.',
    );
    expect(errorText.length).toBeGreaterThan(0);
  });

  it('successfully updates password when inputs are valid', async () => {
    mockedChangePassword.mockResolvedValueOnce(undefined);
    const renderer = renderScreen();

    const currentInput = renderer.root.findByProps({ accessibilityLabel: 'Current Password' });
    const newInput = renderer.root.findByProps({ accessibilityLabel: 'New Password' });
    const confirmInput = renderer.root.findByProps({ accessibilityLabel: 'Confirm New Password' });
    const submitBtn = renderer.root.findByProps({ accessibilityLabel: 'Update Password' });

    act(() => {
      currentInput.props.onChangeText('oldPassword123');
      newInput.props.onChangeText('newSecurePassword456');
      confirmInput.props.onChangeText('newSecurePassword456');
    });

    await act(async () => {
      await submitBtn.props.onPress();
    });

    expect(mockedChangePassword).toHaveBeenCalledWith('oldPassword123', 'newSecurePassword456', 2);
    const successText = renderer.root.findAllByType(Text).filter(
      (node) =>
        node.props.children === 'Password updated successfully. Other active sessions have been signed out.',
    );
    expect(successText.length).toBeGreaterThan(0);
  });

  it('renders setup password guidance for OAuth-only users without password', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 2, email: 'oauth@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: false, created_at: null },
      sessionEpoch: 1,
      logoutAll: mockLogoutAll,
    } as unknown as ReturnType<typeof useAuth>);

    const renderer = renderScreen();

    const setupBtn = renderer.root.findByProps({ accessibilityLabel: 'Set up a password' });
    expect(setupBtn).toBeDefined();

    act(() => {
      setupBtn.props.onPress();
    });

    expect(router.push).toHaveBeenCalledWith('/auth/forgot');
  });

  it('prompts confirmation and executes identity unlinking', async () => {
    mockUnlinkIdentity.mockResolvedValueOnce({ status: 'unlinked' });
    const renderer = renderScreen();

    const unlinkGoogleBtn = renderer.root.findByProps({ accessibilityLabel: 'Unlink Google' });
    act(() => {
      unlinkGoogleBtn.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Unlink Google?',
      expect.stringContaining('Are you sure you want to remove Google as a sign-in method?'),
      expect.any(Array),
    );

    // Trigger confirmation action from alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const unlinkAction = buttons.find((b: { text: string }) => b.text === 'Unlink');

    await act(async () => {
      await unlinkAction.onPress();
    });

    expect(mockUnlinkIdentity).toHaveBeenCalledWith('google');
  });

  it('blocks unlinking when only 1 identity exists and user has no password', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 3, email: 'single@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: false, created_at: null },
      sessionEpoch: 1,
      logoutAll: mockLogoutAll,
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseIdentities.mockReturnValue({
      identities: [
        { provider: 'google', provider_email: 'single@gmail.com', linked_at: '2026-01-01T00:00:00Z', status: 'active', can_unlink: false },
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

    const renderer = renderScreen();

    const unlinkBtn = renderer.root.findByProps({ accessibilityLabel: 'Unlink Google' });
    act(() => {
      unlinkBtn.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Cannot Unlink',
      expect.stringContaining('only sign-in method'),
    );
    expect(mockUnlinkIdentity).not.toHaveBeenCalled();
  });

  it('prompts confirmation and executes sign out everywhere', async () => {
    mockLogoutAll.mockResolvedValueOnce(undefined);
    const renderer = renderScreen();

    const logoutAllBtn = renderer.root.findByProps({ accessibilityLabel: 'Sign out of all devices' });
    act(() => {
      logoutAllBtn.props.onPress();
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

    expect(mockLogoutAll).toHaveBeenCalled();
  });

  it('navigates to /account/delete when Delete Account button is pressed', () => {
    const renderer = renderScreen();

    const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account' });
    act(() => {
      deleteBtn.props.onPress();
    });

    expect(router.push).toHaveBeenCalledWith('/account/delete');
  });
});
