import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Alert, Text, useColorScheme } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import AccountScreen from '@/app/account/index';
import { useAuth } from '@/lib/authStore';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    canGoBack: jest.fn(() => true),
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

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

describe('AccountScreen (src/app/account/index.tsx)', () => {
  let queryClient: QueryClient;
  const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
  const mockedOpenBrowserAsync = WebBrowser.openBrowserAsync as jest.MockedFunction<typeof WebBrowser.openBrowserAsync>;

  const mockSignOut = jest.fn();
  const mockLogoutAll = jest.fn();
  const mockRetryBootstrap = jest.fn();
  const mockRecordReturnIntent = jest.fn();

  function renderScreen() {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <AccountScreen />
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
      user: {
        id: 1,
        email: 'user@example.com',
        role: 'admin',
        beta_tester: true,
        email_verified: true,
        has_password: true,
        created_at: '2026-01-15T00:00:00Z',
      },
      state: { status: 'authenticated', user: { id: 1, email: 'user@example.com' } },
      sessionEpoch: 1,
      signOut: mockSignOut,
      logoutAll: mockLogoutAll,
      retryBootstrap: mockRetryBootstrap,
      recordReturnIntent: mockRecordReturnIntent,
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders user identity, badges, security settings, legal links, session controls, and danger zone', () => {
    const renderer = renderScreen();

    const texts = renderer.root.findAllByType(Text).map((t) => t.props.children).flat();

    expect(texts).toContain('Account');
    expect(texts).toContain('user@example.com');
    expect(texts).toContain('admin');
    expect(texts).toContain('beta');
    expect(texts).toContain('verified');
    expect(texts).toContain('Security Settings');
    expect(texts).toContain('Legal & Policies');
    expect(texts).toContain('Privacy Policy');
    expect(texts).toContain('Terms of Service');
    expect(texts).toContain('Sign out');
    expect(texts).toContain('Sign out of all devices');
    expect(texts).toContain('Delete Account');
  });

  it('navigates to /account/security when Security Settings is pressed', () => {
    const renderer = renderScreen();

    const securityBtn = renderer.root.findByProps({ accessibilityLabel: 'Security Settings' });
    act(() => {
      securityBtn.props.onPress();
    });

    expect(router.push).toHaveBeenCalledWith('/account/security');
  });

  it('opens Privacy Policy URL in in-app browser when Privacy Policy row is pressed', async () => {
    const renderer = renderScreen();

    const privacyBtn = renderer.root.findByProps({ accessibilityLabel: 'Privacy Policy' });
    await act(async () => {
      await privacyBtn.props.onPress();
    });

    expect(mockedOpenBrowserAsync).toHaveBeenCalledWith('https://freehire.me/privacy', expect.objectContaining({
      presentationStyle: 'automatic',
    }));
  });

  it('opens Terms of Service URL in in-app browser when Terms of Service row is pressed', async () => {
    const renderer = renderScreen();

    const termsBtn = renderer.root.findByProps({ accessibilityLabel: 'Terms of Service' });
    await act(async () => {
      await termsBtn.props.onPress();
    });

    expect(mockedOpenBrowserAsync).toHaveBeenCalledWith('https://freehire.me/terms', expect.objectContaining({
      presentationStyle: 'automatic',
    }));
  });

  it('executes sign out when Sign out button is pressed', async () => {
    mockSignOut.mockResolvedValueOnce(undefined);
    const renderer = renderScreen();

    const signOutBtn = renderer.root.findByProps({ accessibilityLabel: 'Sign out' });
    await act(async () => {
      await signOutBtn.props.onPress();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('prompts confirmation and executes logoutAll when Sign out of all devices is pressed', async () => {
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

    expect(mockLogoutAll).toHaveBeenCalledTimes(1);
  });

  it('navigates to /account/delete when Delete Account row is pressed', () => {
    const renderer = renderScreen();

    const deleteBtn = renderer.root.findByProps({ accessibilityLabel: 'Delete Account' });
    act(() => {
      deleteBtn.props.onPress();
    });

    expect(router.push).toHaveBeenCalledWith('/account/delete');
  });

  it('renders unauthenticated sign-in state when user is null', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      state: { status: 'guest', reason: 'no_session' },
      sessionEpoch: 0,
      signOut: mockSignOut,
      logoutAll: mockLogoutAll,
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
      signOut: mockSignOut,
      logoutAll: mockLogoutAll,
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
