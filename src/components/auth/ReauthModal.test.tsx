import React from 'react';
import { Platform, Text, TextInput, useColorScheme } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { ReauthModal } from './ReauthModal';
import { useProviders } from '@/hooks/useProviders';
import { useRecentAuth } from '@/hooks/useRecentAuth';
import { useAuth } from '@/lib/authStore';
import { ApiError } from '@/lib/transport';

jest.mock('@/lib/authStore', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/useRecentAuth', () => ({
  useRecentAuth: jest.fn(),
  recordRecentAuth: jest.fn(),
}));

jest.mock('@/hooks/useProviders', () => ({
  useProviders: jest.fn(),
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

describe('ReauthModal', () => {
  const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockedUseRecentAuth = useRecentAuth as jest.MockedFunction<typeof useRecentAuth>;
  const mockedUseProviders = useProviders as jest.MockedFunction<typeof useProviders>;
  const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

  const mockRequestReauth = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'ios';
    mockedUseColorScheme.mockReturnValue('light');

    mockedUseAuth.mockReturnValue({
      user: { id: 1, email: 'user@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null },
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseRecentAuth.mockReturnValue({
      requestReauth: mockRequestReauth,
      hasRecentAuth: false,
      recentAuthExpiresAt: null,
      remainingSeconds: 0,
      recordRecentAuth: jest.fn(),
      clearRecentAuth: jest.fn(),
      executeWithRecentAuth: jest.fn(),
      withRecentAuth: jest.fn(),
    });

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
  });

  it('renders null when visible is false', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReauthModal visible={false} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );
    });
    expect(renderer.toJSON()).toBeNull();
  });

  it('renders title, description, password form, and provider buttons when visible is true', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReauthModal visible={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );
    });

    const root = renderer.root;
    const titleText = root.findAllByType(Text).filter((node) => node.props.children === "Confirm it's you");
    expect(titleText.length).toBeGreaterThan(0);

    const input = root.findByType(TextInput);
    expect(input).toBeDefined();
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('toggles password visibility with eye button', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReauthModal visible={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );
    });

    const root = renderer.root;
    const eyeButton = root.findByProps({ accessibilityLabel: 'Show password' });
    expect(eyeButton).toBeDefined();

    act(() => {
      eyeButton.props.onPress();
    });

    const input = root.findByType(TextInput);
    expect(input.props.secureTextEntry).toBe(false);
  });

  it('submits password reauth successfully and calls onSuccess and onClose', async () => {
    const mockProof = { recent_auth_expires_at: '2026-08-14T12:00:00Z' };
    mockRequestReauth.mockResolvedValueOnce(mockProof);

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReauthModal visible={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );
    });

    const input = renderer.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText('secretPassword123');
    });

    const submitButton = renderer.root.findByProps({ accessibilityLabel: 'Confirm with Password' });
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockRequestReauth).toHaveBeenCalledWith({ method: 'password', password: 'secretPassword123' });
    expect(mockOnSuccess).toHaveBeenCalledWith(mockProof);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays invalid password error when reauth returns 401', async () => {
    const error401 = new ApiError({
      kind: 'http',
      endpoint: '/api/v2/auth/reauth/password',
      status: 401,
      code: 'invalid_credentials',
    });
    mockRequestReauth.mockRejectedValueOnce(error401);

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReauthModal visible={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );
    });

    const input = renderer.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText('wrongPass');
    });

    const submitButton = renderer.root.findByProps({ accessibilityLabel: 'Confirm with Password' });
    await act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();

    const errorText = renderer.root.findAllByType(Text).filter(
      (node) => node.props.children === 'Invalid password. Please try again.',
    );
    expect(errorText.length).toBeGreaterThan(0);
  });

  it('omits password section for OAuth-only users without password', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 2, email: 'oauth@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: false, created_at: null },
    } as unknown as ReturnType<typeof useAuth>);

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReauthModal visible={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );
    });

    const inputs = renderer.root.findAllByType(TextInput);
    expect(inputs).toHaveLength(0);
  });

  it('calls onClose when close button (xmark) is pressed', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ReauthModal visible={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />,
      );
    });

    const closeBtn = renderer.root.findByProps({ accessibilityLabel: 'Close' });
    act(() => {
      closeBtn.props.onPress();
    });

    expect(mockOnClose).toHaveBeenCalled();
  });
});
