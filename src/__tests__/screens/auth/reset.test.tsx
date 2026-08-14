import React from 'react';
import { TextInput, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useLocalSearchParams, router } from 'expo-router';

import ResetPasswordScreen from '@/app/auth/reset';
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
      resetPassword: jest.fn(),
    },
  };
});

describe('ResetPasswordScreen (/auth/reset)', () => {
  const mockedUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseLocalSearchParams.mockReturnValue({});
  });

  it('renders screen with header, inputs, and submit button', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ResetPasswordScreen />);
    });

    const textNodes = renderer!.root.findAllByType(Text);
    const title = textNodes.find((t) => t.props.children === 'Reset password');
    expect(title).toBeDefined();

    const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Reset password' });
    expect(submitBtn).toBeDefined();
  });

  it('pre-fills email and token/code when params are provided', () => {
    mockedUseLocalSearchParams.mockReturnValue({
      email: 'resetme@example.com',
      token: 'secrettoken123',
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ResetPasswordScreen />);
    });

    const inputs = renderer!.root.findAllByType(TextInput);
    const emailInput = inputs[0]!;
    const codeInput = inputs[1]!;

    expect(emailInput.props.value).toBe('resetme@example.com');
    expect(codeInput.props.value).toBe('secrettoken123');
  });

  it('submits reset password and shows success state upon completion', async () => {
    (authApi.resetPassword as jest.Mock).mockResolvedValueOnce(undefined);
    mockedUseLocalSearchParams.mockReturnValue({
      email: 'success@example.com',
      code: '888888',
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ResetPasswordScreen />);
    });

    const inputs = renderer!.root.findAllByType(TextInput);
    const passwordInput = inputs[2]!;

    act(() => {
      passwordInput.props.onChangeText('brandNewPassword123');
    });

    const submitBtn = renderer!.root.findByProps({ accessibilityLabel: 'Reset password' });
    await act(async () => {
      await submitBtn.props.onPress();
    });

    expect(authApi.resetPassword).toHaveBeenCalledWith('success@example.com', '888888', 'brandNewPassword123');

    const textNodes = renderer!.root.findAllByType(Text);
    const successMsg = textNodes.find((t) => {
      const content = Array.isArray(t.props.children) ? t.props.children.join('') : t.props.children;
      return typeof content === 'string' && content.includes('successfully reset');
    });
    expect(successMsg).toBeDefined();
  });

  it('dismisses back when close button is pressed', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ResetPasswordScreen />);
    });

    const closeBtn = renderer!.root.findByProps({ accessibilityLabel: 'Close' });
    act(() => {
      closeBtn.props.onPress();
    });

    expect(router.back).toHaveBeenCalled();
  });
});
