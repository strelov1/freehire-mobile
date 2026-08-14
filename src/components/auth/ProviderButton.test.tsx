import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { ProviderButton, providerLabel } from './ProviderButton';
import type { V2Provider } from '@/features/auth/model/authV2Types';
import { useAuth } from '@/lib/authStore';

jest.mock('@/lib/authStore', () => ({
  useAuth: jest.fn(),
}));

describe('ProviderButton', () => {
  const mockSignInWithProviderV2 = jest.fn();
  const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      signInWithProviderV2: mockSignInWithProviderV2,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('formats provider labels correctly', () => {
    expect(providerLabel('google')).toBe('Google');
    expect(providerLabel('github')).toBe('GitHub');
    expect(providerLabel('linkedin')).toBe('LinkedIn');
    expect(providerLabel('apple')).toBe('Apple');
    expect(providerLabel('custom')).toBe('Custom');
  });

  it('renders provider button label for available provider', () => {
    const provider: V2Provider = {
      id: 'google',
      flow: 'browser_oauth',
      platforms: ['ios', 'android'],
      available: true,
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ProviderButton provider={provider} />);
    });

    const textNodes = renderer!.root.findAllByType(Text);
    const labelNode = textNodes.find((t) => t.props.children === 'Continue with Google');
    expect(labelNode).toBeDefined();
  });

  it('renders coming soon label and disables pressable when available is false', () => {
    const provider: V2Provider = {
      id: 'linkedin',
      flow: 'browser_oauth',
      platforms: ['ios', 'android'],
      available: false,
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ProviderButton provider={provider} />);
    });

    const textNodes = renderer!.root.findAllByType(Text);
    const labelNode = textNodes.find((t) => t.props.children === 'Continue with LinkedIn (Coming soon)');
    expect(labelNode).toBeDefined();

    const pressable = renderer!.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.disabled).toBe(true);
  });

  it('calls custom onPress when provided', async () => {
    const onPress = jest.fn();
    const provider: V2Provider = {
      id: 'github',
      flow: 'browser_oauth',
      platforms: ['ios', 'android'],
      available: true,
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ProviderButton provider={provider} onPress={onPress} />);
    });

    const pressable = renderer!.root.findByProps({ accessibilityRole: 'button' });
    await act(async () => {
      await pressable.props.onPress();
    });

    expect(onPress).toHaveBeenCalledWith('github');
    expect(mockSignInWithProviderV2).not.toHaveBeenCalled();
  });

  it('calls signInWithProviderV2 and onSuccess by default', async () => {
    const onSuccess = jest.fn();
    const mockResult = { status: 'success', intent: 'none' };
    mockSignInWithProviderV2.mockResolvedValueOnce(mockResult);

    const provider: V2Provider = {
      id: 'github',
      flow: 'browser_oauth',
      platforms: ['ios', 'android'],
      available: true,
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ProviderButton provider={provider} onSuccess={onSuccess} />);
    });

    const pressable = renderer!.root.findByProps({ accessibilityRole: 'button' });
    await act(async () => {
      await pressable.props.onPress();
    });

    expect(mockSignInWithProviderV2).toHaveBeenCalledWith('github', 'sign_in');
    expect(onSuccess).toHaveBeenCalledWith(mockResult);
  });

  it('handles cancellation silently without invoking onError', async () => {
    const onError = jest.fn();
    mockSignInWithProviderV2.mockResolvedValueOnce({ status: 'cancelled', intent: 'none' });

    const provider: V2Provider = {
      id: 'google',
      flow: 'browser_oauth',
      platforms: ['ios', 'android'],
      available: true,
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ProviderButton provider={provider} onError={onError} />);
    });

    const pressable = renderer!.root.findByProps({ accessibilityRole: 'button' });
    await act(async () => {
      await pressable.props.onPress();
    });

    expect(onError).not.toHaveBeenCalled();
  });

  it('handles errors by invoking onError callback', async () => {
    const onError = jest.fn();
    const err = new Error('OAuth start failure');
    mockSignInWithProviderV2.mockRejectedValueOnce(err);

    const provider: V2Provider = {
      id: 'google',
      flow: 'browser_oauth',
      platforms: ['ios', 'android'],
      available: true,
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ProviderButton provider={provider} onError={onError} />);
    });

    const pressable = renderer!.root.findByProps({ accessibilityRole: 'button' });
    await act(async () => {
      await pressable.props.onPress();
    });

    expect(onError).toHaveBeenCalledWith(err);
  });

  it('renders ActivityIndicator when loading is true', () => {
    const provider: V2Provider = {
      id: 'google',
      flow: 'browser_oauth',
      platforms: ['ios', 'android'],
      available: true,
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<ProviderButton provider={provider} loading={true} />);
    });

    const indicator = renderer!.root.findByType(ActivityIndicator);
    expect(indicator).toBeDefined();
  });
});
