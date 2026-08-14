import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
  useColorScheme,
} from 'react-native';

import type { AuthCompletion } from '@/features/auth/model/authTypes';
import type { RecentAuthProof } from '@/features/auth/model/authV2Types';
import { useAuth } from '@/lib/authStore';

export interface AppleSignInButtonProps {
  purpose?: 'sign_in' | 'reauth';
  disabled?: boolean;
  loading?: boolean;
  onSuccess?: (result: AuthCompletion | RecentAuthProof) => void;
  onError?: (error: unknown) => void;
  style?: StyleProp<ViewStyle>;
  buttonType?: AppleAuthentication.AppleAuthenticationButtonType;
  buttonStyle?: AppleAuthentication.AppleAuthenticationButtonStyle;
  cornerRadius?: number;
}

/**
 * iOS-native Sign in with Apple button following Apple Human Interface Guidelines.
 *
 * Automatically switches to WHITE style in Dark Mode and BLACK style in Light Mode.
 * Returns `null` when rendered on non-iOS platforms (Android, Web).
 * Silent cancellation (code 1001 / ERR_REQUEST_CANCELED) is absorbed without error alerts.
 */
export function AppleSignInButton({
  purpose = 'sign_in',
  disabled = false,
  loading = false,
  onSuccess,
  onError,
  style,
  buttonType,
  buttonStyle,
  cornerRadius = 100,
}: AppleSignInButtonProps) {
  const { signInWithApple } = useAuth();
  const colorScheme = useColorScheme();
  const [internalBusy, setInternalBusy] = useState(false);

  if (Platform.OS !== 'ios') {
    return null;
  }

  const isBusy = loading || internalBusy;
  const isDisabled = disabled || isBusy;

  const resolvedButtonStyle =
    buttonStyle ??
    (colorScheme === 'dark'
      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK);

  const resolvedButtonType =
    buttonType ?? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE;

  const handlePress = async () => {
    if (isDisabled) return;
    setInternalBusy(true);
    try {
      const result = await signInWithApple(purpose);
      if ('status' in result && result.status === 'cancelled') {
        return;
      }
      onSuccess?.(result);
    } catch (err: unknown) {
      onError?.(err);
    } finally {
      setInternalBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        style,
        isDisabled && styles.disabled,
      ]}
      pointerEvents={isDisabled ? 'none' : 'auto'}
      accessibilityRole="button"
      accessibilityLabel="Sign in with Apple"
      accessibilityState={{ disabled: isDisabled, busy: isBusy }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={resolvedButtonType}
        buttonStyle={resolvedButtonStyle}
        cornerRadius={cornerRadius}
        style={styles.button}
        onPress={handlePress}
      />
      {isBusy ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={colorScheme === 'dark' ? '#000000' : '#FFFFFF'} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    width: '100%',
    borderRadius: 100,
    overflow: 'hidden',
  },
  button: {
    width: '100%',
    height: 48,
  },
  disabled: {
    opacity: 0.6,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
});
