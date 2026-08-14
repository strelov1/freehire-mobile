import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  useColorScheme,
} from 'react-native';

import { ProviderIcon } from '@/components/ProviderIcon';
import { getColors } from '@/constants/freehire';
import type { AuthCompletion } from '@/features/auth/model/authTypes';
import type { RecentAuthProof, V2Provider } from '@/features/auth/model/authV2Types';
import { useAuth } from '@/lib/authStore';

export type ProviderButtonProps = {
  provider: V2Provider;
  disabled?: boolean;
  loading?: boolean;
  purpose?: 'sign_in' | 'reauth';
  onPress?: (providerId: string) => void;
  onSuccess?: (result: AuthCompletion | RecentAuthProof) => void;
  onError?: (error: unknown) => void;
  style?: StyleProp<ViewStyle>;
};

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  linkedin: 'LinkedIn',
  apple: 'Apple',
};

export function providerLabel(id: string): string {
  return PROVIDER_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Standardized button for browser PKCE OAuth flows (Google, GitHub, LinkedIn).
 * Displays branded vector icon via ProviderIcon, handles loading indicators,
 * and renders a disabled "Coming soon" state when `available: false`.
 */
export function ProviderButton({
  provider,
  disabled = false,
  loading = false,
  purpose = 'sign_in',
  onPress,
  onSuccess,
  onError,
  style,
}: ProviderButtonProps) {
  const colors = getColors(useColorScheme());
  const { signInWithProviderV2 } = useAuth();
  const [internalBusy, setInternalBusy] = useState(false);

  const isBusy = loading || internalBusy;
  const isAvailable = provider.available !== false;
  const isDisabled = disabled || isBusy || !isAvailable;

  const handlePress = async () => {
    if (isDisabled) return;
    if (onPress) {
      onPress(provider.id);
      return;
    }
    setInternalBusy(true);
    try {
      const result = await signInWithProviderV2(provider.id, purpose);
      if ('status' in result && result.status === 'cancelled') {
        return;
      }
      onSuccess?.(result);
    } catch (err) {
      onError?.(err);
    } finally {
      setInternalBusy(false);
    }
  };

  const name = providerLabel(provider.id);
  const label = isAvailable ? `Continue with ${name}` : `Continue with ${name} (Coming soon)`;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: isBusy }}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {isBusy ? (
        <ActivityIndicator color={colors.foreground} />
      ) : (
        <View style={styles.content}>
          <ProviderIcon provider={provider.id} size={18} color={colors.foreground} />
          <Text style={[styles.text, { color: isAvailable ? colors.foreground : colors.mutedForeground }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
