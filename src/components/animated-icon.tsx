import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BrandMark } from '@/components/BrandMark';

const DURATION = 400;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Hide native splash screen immediately
    SplashScreen.hideAsync().catch(() => {});

    // Fade out splash overlay smoothly
    opacity.set(
      withTiming(0, { duration: DURATION }, (finished) => {
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      }),
    );

    // Bulletproof safety fallback to guarantee overlay unmounts
    const timer = setTimeout(() => {
      setVisible(false);
    }, DURATION + 100);

    return () => clearTimeout(timer);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }));

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.splashOverlay, animatedStyle]}>
      <BrandMark size={104} color="#fafafa" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
});
