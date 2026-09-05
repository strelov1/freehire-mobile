/**
 * freehire design tokens for React Native.
 *
 * These are READ from `tokens.generated.ts`, which `npm run sync-tokens`
 * regenerates from `../hire/design-system/tokens` — the same source the web
 * builds its Tailwind theme from. This file adds only what the source cannot
 * give: semantic names for the scales, and one derived colour.
 *
 * It used to hold its own hand-written copy of every value, made before the
 * sync existed. The copy then drifted: twelve of the dark theme's sixteen
 * colours had wandered off the design system, and nothing said so, because
 * nothing compared them. That is the failure the sync was introduced to end,
 * and a second hand-maintained palette beside the generated one is how it came
 * back. Add a colour to the design system and re-run the sync — do not add one
 * here.
 *
 * The brand is Granola's "oats green": `brand` is the solid CTA fill,
 * `brandStrong` the readable text/link tone, `brandMuted` the soft chip tint.
 */

import { paletteDark, paletteLight, radius, spacing, type GeneratedPalette } from './tokens.generated';

/**
 * Every generated colour, plus the muted destructive fill.
 *
 * `destructive-muted` is not in the design system: on the web it is written
 * inline as `bg-destructive/10`, an opacity modifier Tailwind applies at the
 * call site. React Native has no such modifier, so the tint is derived here
 * instead — the one value in this file that is computed rather than read.
 */
export type FreehirePalette = GeneratedPalette & {
  destructiveMuted: string;
};

/** ~15% of a colour, for a fill that has to sit under text.
 *
 *  Handles both shapes the token generator emits: `#rrggbb` (append an alpha
 *  byte) and `rgba(r, g, b, a)` (replace the alpha). Anything else is returned
 *  untouched rather than mangled into an invalid colour. */
export function withMutedAlpha(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}26`;

  const rgba = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(color);
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, 0.15)`;

  return color;
}

function palette(generated: GeneratedPalette): FreehirePalette {
  return { ...generated, destructiveMuted: withMutedAlpha(generated.destructive) };
}

const light = palette(paletteLight);
const dark = palette(paletteDark);

/** Accepts RN's `ColorSchemeName` (which includes 'unspecified') — anything that
 *  isn't explicitly 'dark' resolves to the light palette. */
export function getColors(scheme: string | null | undefined): FreehirePalette {
  return scheme === 'dark' ? dark : light;
}

/** Read one step of a generated scale, refusing to carry on without it.
 *
 *  The generated scales are `Record<string, number>`, so a renamed or dropped
 *  token would otherwise arrive as `undefined` and spread silently through the
 *  layout as a missing margin. Failing at module load says which token went. */
function step(scale: Record<string, number>, key: string, label: string): number {
  const value = scale[key];
  if (value === undefined) {
    throw new Error(`design tokens: ${label} scale has no "${key}" — re-run \`npm run sync-tokens\``);
  }
  return value;
}

/** Semantic names over the generated 4px spacing scale. The scale is the design
 *  system's; the names are this app's, because a screen reads better saying
 *  `Space.lg` than `spacing['4']`. */
export const Space = {
  xs: step(spacing, '1', 'spacing'),
  sm: step(spacing, '2', 'spacing'),
  md: step(spacing, '3', 'spacing'),
  lg: step(spacing, '4', 'spacing'),
  xl: step(spacing, '6', 'spacing'),
} as const;

/** Corner radii, likewise named. `pill` is not a design-system token — it is the
 *  "fully round" idiom for chips, which a scale of fixed radii cannot express. */
export const Radius = {
  md: step(radius, 'md', 'radius'),
  lg: step(radius, 'lg', 'radius'),
  xl: step(radius, 'xl', 'radius'),
  pill: 999,
} as const;
