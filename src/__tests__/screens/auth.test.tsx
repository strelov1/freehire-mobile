import React from 'react';
import { Platform, TextInput, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useLocalSearchParams, router } from 'expo-router';

import AuthScreen from '@/app/auth';
import { authApi } from '@/features/auth/api/authApi';
import { useAuth } from '@/lib/authStore';
import { useProviders } from '@/hooks/useProviders';

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

jest.mock('@/hooks/useProviders', () => ({
  useProviders: jest.fn(),
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

describe('AuthScreen (Multi-Mode Auth Modal)', () => {
  const mockSignIn = jest.fn();
  const mockSignUp = jest.fn();
  const mockClearReturnIntent = jest.fn();
  const mockRetryReturnIntent = jest.fn();
  const mockSignInWithProviderV2 = jest.fn();
  const mockSignInWithApple = jest.fn();

  const mockedUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;
  const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockedUseProviders = useProviders as jest.MockedFunction<typeof useProviders>;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'ios';
    mockedUseLocalSearchParams.mockReturnValue({});
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

    mockedUseAuth.mockReturnValue({
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
  });

  it('renders default sign in mode with social buttons, email/password fields, and tab switcher', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen />);
    });

    const textNodes = renderer!.root.findAllByType(Text);
    const title = textNodes.find((t) => t.props.children === 'Sign in');
    expect(title).toBeDefined();

    // Check tabs by text
    const loginTabText = textNodes.find((t) => t.props.children === 'Log in');
    const registerTabText = textNodes.find((t) => t.props.children === 'Register');
    expect(loginTabText).toBeDefined();
    expect(registerTabText).toBeDefined();

    // Check submit button
    const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Log in' });
    expect(submitBtn).toBeDefined();
  });

  it('switches between Log in and Register tabs', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen />);
    });

    const pressablesWithTabs = renderer!.root
      .findAllByProps({ accessibilityRole: 'tab' })
      .filter((node) => typeof node.props.onPress === 'function');
    expect(pressablesWithTabs).toHaveLength(2);

    const registerTab = pressablesWithTabs[1]!;
    act(() => {
      registerTab.props.onPress();
    });

    const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Create account' });
    expect(submitBtn).toBeDefined();
  });

  it('initializes in forgot mode when mode=forgot search param is passed', () => {
    mockedUseLocalSearchParams.mockReturnValue({ mode: 'forgot', email: 'test@example.com' });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen />);
    });

    const textNodes = renderer!.root.findAllByType(Text);
    const title = textNodes.find((t) => t.props.children === 'Forgot password');
    expect(title).toBeDefined();

    // Social buttons and tabs should not be rendered in forgot mode
    const tabs = renderer!.root.findAllByProps({ accessibilityRole: 'tab' });
    expect(tabs).toHaveLength(0);
  });

  it('initializes in reset mode when token and email params are passed', () => {
    mockedUseLocalSearchParams.mockReturnValue({ token: 'abc123token', email: 'user@domain.com' });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen />);
    });

    const textNodes = renderer!.root.findAllByType(Text);
    const title = textNodes.find((t) => t.props.children === 'Reset password');
    expect(title).toBeDefined();
  });

  it('submits forgot password flow and updates status on success', async () => {
    (authApi.forgotPassword as jest.Mock).mockResolvedValueOnce(undefined);
    mockedUseLocalSearchParams.mockReturnValue({ mode: 'forgot' });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen />);
    });

    const inputs = renderer!.root.findAllByType(TextInput);
    const emailInput = inputs[0]!;

    act(() => {
      emailInput.props.onChangeText('forgotuser@example.com');
    });

    const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Send reset code' });
    await act(async () => {
      await submitBtn.props.onPress();
    });

    expect(authApi.forgotPassword).toHaveBeenCalledWith('forgotuser@example.com');
    const textNodes = renderer!.root.findAllByType(Text);
    const confirmation = textNodes.find((t) => {
      const content = Array.isArray(t.props.children) ? t.props.children.join('') : t.props.children;
      return typeof content === 'string' && content.includes('Check your email');
    });
    expect(confirmation).toBeDefined();
  });

  it('submits reset password flow and shows success message', async () => {
    (authApi.resetPassword as jest.Mock).mockResolvedValueOnce(undefined);
    mockedUseLocalSearchParams.mockReturnValue({ mode: 'reset', email: 'reset@example.com', code: '654321' });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen />);
    });

    const inputs = renderer!.root.findAllByType(TextInput);
    // Find password input
    const passwordInput = inputs[inputs.length - 1]!;

    act(() => {
      passwordInput.props.onChangeText('newSecurePassword123');
    });

    const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Reset password' });
    await act(async () => {
      await submitBtn.props.onPress();
    });

    expect(authApi.resetPassword).toHaveBeenCalledWith('reset@example.com', '654321', 'newSecurePassword123');
    const textNodes = renderer!.root.findAllByType(Text);
    const successMsg = textNodes.find((t) =>
      typeof t.props.children === 'string' && t.props.children.includes('successfully reset'),
    );
    expect(successMsg).toBeDefined();
  });

  it('submits sign in form and navigates back upon success', async () => {
    mockSignIn.mockResolvedValueOnce({ status: 'success', intent: 'none' });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen />);
    });

    const inputs = renderer!.root.findAllByType(TextInput);
    const emailInput = inputs[0]!;
    const passwordInput = inputs[1]!;

    act(() => {
      emailInput.props.onChangeText('signin@example.com');
      passwordInput.props.onChangeText('securepassword');
    });

    const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Log in' });
    await act(async () => {
      await submitBtn.props.onPress();
    });

    expect(mockSignIn).toHaveBeenCalledWith('signin@example.com', 'securepassword');
    expect(router.back).toHaveBeenCalled();
  });

  it('dismisses modal and clears return intent when close button is tapped', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AuthScreen />);
    });

    const closeBtn = renderer!.root.findByProps({ accessibilityLabel: 'Close auth sheet' });
    act(() => {
      closeBtn.props.onPress();
    });

    expect(mockClearReturnIntent).toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });
});
