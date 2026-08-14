import React from 'react';
import { Platform, useColorScheme } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import * as AppleAuthentication from 'expo-apple-authentication';

import { AppleSignInButton } from './AppleSignInButton';
import { useAuth } from '@/lib/authStore';

jest.mock('@/lib/authStore', () => ({
  useAuth: jest.fn(),
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

describe('AppleSignInButton', () => {
  const mockSignInWithApple = jest.fn();
  const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'ios';
    mockedUseColorScheme.mockReturnValue('light');
    mockedUseAuth.mockReturnValue({
      signInWithApple: mockSignInWithApple,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('renders null when Platform.OS is android', () => {
    (Platform as { OS: string }).OS = 'android';
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AppleSignInButton />);
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders AppleAuthenticationButton on iOS with light theme style', () => {
    (Platform as { OS: string }).OS = 'ios';
    mockedUseColorScheme.mockReturnValue('light');
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AppleSignInButton />);
    });
    const appleBtn = renderer!.root.findByType('AppleAuthenticationButton' as unknown as React.ComponentType);
    expect(appleBtn).toBeDefined();
    expect(appleBtn.props.buttonStyle).toBe(AppleAuthentication.AppleAuthenticationButtonStyle.BLACK);
    expect(appleBtn.props.buttonType).toBe(AppleAuthentication.AppleAuthenticationButtonType.CONTINUE);
    expect(appleBtn.props.cornerRadius).toBe(100);
  });

  it('renders AppleAuthenticationButton with WHITE style in dark mode', () => {
    (Platform as { OS: string }).OS = 'ios';
    mockedUseColorScheme.mockReturnValue('dark');
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AppleSignInButton />);
    });
    const appleBtn = renderer!.root.findByType('AppleAuthenticationButton' as unknown as React.ComponentType);
    expect(appleBtn.props.buttonStyle).toBe(AppleAuthentication.AppleAuthenticationButtonStyle.WHITE);
  });

  it('triggers signInWithApple and onSuccess upon press', async () => {
    const onSuccess = jest.fn();
    const mockResult = { status: 'success', intent: 'none' };
    mockSignInWithApple.mockResolvedValueOnce(mockResult);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AppleSignInButton onSuccess={onSuccess} />);
    });

    const appleBtn = renderer!.root.findByType('AppleAuthenticationButton' as unknown as React.ComponentType);
    await act(async () => {
      await appleBtn.props.onPress();
    });

    expect(mockSignInWithApple).toHaveBeenCalledWith('sign_in');
    expect(onSuccess).toHaveBeenCalledWith(mockResult);
  });

  it('handles user cancellation silently without calling onError', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    mockSignInWithApple.mockResolvedValueOnce({ status: 'cancelled', intent: 'none' });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AppleSignInButton onSuccess={onSuccess} onError={onError} />,
      );
    });

    const appleBtn = renderer!.root.findByType('AppleAuthenticationButton' as unknown as React.ComponentType);
    await act(async () => {
      await appleBtn.props.onPress();
    });

    expect(mockSignInWithApple).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('handles error by invoking onError callback', async () => {
    const onError = jest.fn();
    const errorObj = new Error('Exchange failed');
    mockSignInWithApple.mockRejectedValueOnce(errorObj);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<AppleSignInButton onError={onError} />);
    });

    const appleBtn = renderer!.root.findByType('AppleAuthenticationButton' as unknown as React.ComponentType);
    await act(async () => {
      await appleBtn.props.onPress();
    });

    expect(onError).toHaveBeenCalledWith(errorObj);
  });
});
