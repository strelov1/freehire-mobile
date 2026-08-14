import React from 'react';
import { TextInput, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useLocalSearchParams, router } from 'expo-router';

import ForgotPasswordScreen from '@/app/auth/forgot';
import { authApi } from '@/features/auth/api/authApi';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    replace: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('@/features/auth/api/authApi', () => {
  const original = jest.requireActual('@/features/auth/api/authApi');
  return {
    ...original,
    authApi: {
      ...original.authApi,
      forgotPassword: jest.fn(),
    },
  };
});

describe('ForgotPasswordScreen (/auth/forgot)', () => {
  const mockedUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseLocalSearchParams.mockReturnValue({});
  });

  it('renders screen with header, email input, and submit button', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ForgotPasswordScreen />);
    });

    const textNodes = renderer!.root.findAllByType(Text);
    const title = textNodes.find((t) => t.props.children === 'Forgot password');
    expect(title).toBeDefined();

    const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Send reset code' });
    expect(submitBtn).toBeDefined();
  });

  it('pre-fills email when email param is present', () => {
    mockedUseLocalSearchParams.mockReturnValue({ email: 'preset@example.com' });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ForgotPasswordScreen />);
    });

    const emailInput = renderer!.root.findByType(TextInput);
    expect(emailInput.props.value).toBe('preset@example.com');
  });

  it('submits forgot password and renders confirmation message on success', async () => {
    (authApi.forgotPassword as jest.Mock).mockResolvedValueOnce(undefined);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ForgotPasswordScreen />);
    });

    const emailInput = renderer!.root.findByType(TextInput);
    act(() => {
      emailInput.props.onChangeText('submit@example.com');
    });

    const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Send reset code' });
    await act(async () => {
      await submitBtn.props.onPress();
    });

    expect(authApi.forgotPassword).toHaveBeenCalledWith('submit@example.com');

    const textNodes = renderer!.root.findAllByType(Text);
    const confirmation = textNodes.find((t) => {
      const content = Array.isArray(t.props.children) ? t.props.children.join('') : t.props.children;
      return typeof content === 'string' && content.includes('Check your email');
    });
    expect(confirmation).toBeDefined();
  });

  it('dismisses back when close button is pressed', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ForgotPasswordScreen />);
    });

    const closeBtn = renderer!.root.findByProps({ accessibilityLabel: 'Close' });
    act(() => {
      closeBtn.props.onPress();
    });

    expect(router.back).toHaveBeenCalled();
  });
});
