/**
 * freehire design tokens, ported from the web app's Tailwind theme (src/app.css).
 *
 * The web defines colors as `oklch()` CSS variables with a light and dark set.
 * React Native has no oklch, so each value is converted to its hex equivalent
 * here — this file is the single source of truth for color, mirroring the CSS
 * `:root` / `.dark` blocks. Components read a token by name (e.g. `c.border`),
 * never a raw hex, so switching light/dark just swaps the palette object.
 *
 * The brand is Granola's "oats green" (#5b6f00): `brand` is the solid CTA fill,
 * `brandStrong` the readable text/link tone, `brandMuted` the soft chip tint.
 */

export type FreehirePalette = {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  border: string;
  brand: string;
  brandForeground: string;
  brandStrong: string;
  brandMuted: string;
  brandRing: string;
  destructive: string;
  destructiveMuted: string;
  warning: string;
  warningStrong: string;
  warningMuted: string;
};

const light: FreehirePalette = {
  background: '#fdfdfb', // oklch(0.997 0.003 130) — warm near-white
  foreground: '#1c1c1c', // oklch(0.13 0 0)
  card: '#ffffff', // oklch(1 0 0)
  muted: '#f2f2f2', // oklch(0.955 0 0)
  mutedForeground: '#6f6f6f', // oklch(0.43 0 0)
  accent: '#e9e9e9', // oklch(0.93 0 0)
  border: '#e6e6e6', // oklch(0.92 0 0)
  brand: '#5b6f00',
  brandForeground: '#f3f6e2',
  brandStrong: '#4c5c00',
  brandMuted: '#e5eacd',
  brandRing: '#b2c248',
  destructive: '#dc2626', // oklch(0.577 0.245 27.325) — shadcn default red-600
  destructiveMuted: '#dc262626', // destructive at ~15% alpha
  // The third tone the profile match needs: a skill held only through a
  // neighbour is neither had nor missing. Values taken from the synced
  // `tokens.generated.ts` so they are the web's amber, not one picked by eye.
  warning: '#fe9a00',
  warningStrong: '#bb4d00',
  warningMuted: '#fef3c6',
};

const dark: FreehirePalette = {
  background: '#191a15', // oklch(0.16 0.006 110) — warm near-black
  foreground: '#fafafa', // oklch(0.985 0 0)
  card: '#181818', // oklch(0.155 0 0)
  muted: '#2a2a2a', // oklch(0.24 0 0)
  mutedForeground: '#b4b4b4', // oklch(0.72 0 0)
  accent: '#303030', // oklch(0.27 0 0)
  border: '#ffffff14', // oklch(1 0 0 / 8%) — white at 8%
  brand: '#9fb15f', // oklch(0.72 0.095 121) — calmer olive on dark
  brandForeground: '#24260f', // oklch(0.18 0.02 120)
  brandStrong: '#adbf6d', // oklch(0.79 0.1 118)
  brandMuted: '#3b3f28', // oklch(0.31 0.045 118)
  brandRing: '#8ea24f', // oklch(0.6 0.09 118)
  destructive: '#f87171', // oklch(0.704 0.191 22.216) — calmer red on dark
  destructiveMuted: '#f8717126', // destructive at ~15% alpha
  warning: '#ffb900',
  warningStrong: '#ffb900', // the dark theme reads the amber itself as the text tone
  warningMuted: '#461901',
};

/** Accepts RN's `ColorSchemeName` (which includes 'unspecified') — anything that
 *  isn't explicitly 'dark' resolves to the light palette. */
export function getColors(scheme: string | null | undefined): FreehirePalette {
  return scheme === 'dark' ? dark : light;
}

/** Spacing scale mirroring the web's Tailwind rhythm (4px base). */
export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** Corner radii — cards use `xl` (matches web `rounded-xl`), chips are pill-shaped. */
export const Radius = {
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;
