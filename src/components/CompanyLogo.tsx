import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/freehire';

/** The company's real logo, as served by freehire's own logo proxy (tries
 *  faviconapi.com then logo.dev server-side — no client-exposed key, so unlike
 *  logo.dev directly this resolves fine from a native app). Mirrors
 *  `hire/web/src/lib/logo.ts`. Returns null for an empty name, same as the
 *  monogram fallback's own "no name" case. */
export function companyLogoUrl(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return `https://logo.freehire.me/${encodeURIComponent(trimmed)}`;
}

/**
 * A company's logo: the real image from `companyLogoUrl`, falling back to a
 * monogram tile (first letter over a colour hashed from the full name, stable
 * per company) when there's no name or the image fails to load. This is the
 * same fallback chain as the web card (hire/web CompanyLogo).
 */
export function CompanyLogo({ name, size = 28 }: { name: string; size?: number }) {
  // Tracks the name a load failed FOR, not a bare boolean — the feed recycles
  // this component across rows (FlashList), so a plain `useState(false)` would
  // keep showing another company's monogram after scrolling onto a new one.
  const [failedName, setFailedName] = useState<string | null>(null);
  const trimmed = name.trim();
  const initial = (trimmed[0] ?? '?').toUpperCase();
  const uri = companyLogoUrl(name);

  if (uri && failedName !== name) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: Radius.md }}
        contentFit="contain"
        onError={() => setFailedName(name)}
      />
    );
  }

  // Same hash as the web monogram: fold char codes into a 0–359 hue so the tile
  // is stable per company and spread across the wheel.
  let hue = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hue = (hue * 31 + trimmed.charCodeAt(i)) % 360;
  }

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Radius.md,
          backgroundColor: `hsl(${hue}, 52%, 45%)`,
        },
      ]}>
      <Text style={[styles.letter, { fontSize: size * 0.5 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
