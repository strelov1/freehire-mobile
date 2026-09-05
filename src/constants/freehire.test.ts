import { getColors, Radius, Space, withAlpha } from './freehire';
import { paletteDark, paletteLight, radius, spacing } from './tokens.generated';

describe('the palette comes from the generated tokens', () => {
  // The hand-written copy this replaced had drifted twelve of the dark theme's
  // sixteen colours off the design system, with nothing comparing them. This
  // test is that comparison.
  it('serves the generated light palette', () => {
    const c = getColors('light');
    expect(c.background).toBe(paletteLight.background);
    expect(c.brand).toBe(paletteLight.brand);
    expect(c.warningStrong).toBe(paletteLight.warningStrong);
  });

  it('serves the generated dark palette', () => {
    const c = getColors('dark');
    expect(c.background).toBe(paletteDark.background);
    expect(c.brandMuted).toBe(paletteDark.brandMuted);
  });

  it('treats anything that is not "dark" as light', () => {
    // RN's ColorSchemeName includes 'unspecified', and null before it settles.
    expect(getColors('unspecified').background).toBe(paletteLight.background);
    expect(getColors(null).background).toBe(paletteLight.background);
    expect(getColors(undefined).background).toBe(paletteLight.background);
  });
});

describe('withAlpha', () => {
  // The React Native answer to the web's `bg-destructive/10` — a Tailwind
  // opacity modifier, which is not a token and so cannot be generated.
  it('appends an alpha byte to a hex colour', () => {
    expect(withAlpha('#dc2626', 0.15)).toBe('#dc262626');
    expect(withAlpha('#dc2626', 0.4)).toBe('#dc262666');
    expect(withAlpha('#dc2626', 1)).toBe('#dc2626ff');
  });

  it('pads a single-digit alpha byte, so the colour stays eight characters', () => {
    expect(withAlpha('#dc2626', 0.02)).toBe('#dc262605');
  });

  it('replaces the alpha of an rgba colour', () => {
    // The generator emits rgba for any source token carrying an alpha.
    expect(withAlpha('rgba(255, 255, 255, 0.08)', 0.15)).toBe('rgba(255, 255, 255, 0.15)');
  });

  it('clamps an alpha outside the range rather than emitting a broken colour', () => {
    expect(withAlpha('#dc2626', 2)).toBe('#dc2626ff');
    expect(withAlpha('#dc2626', -1)).toBe('#dc262600');
  });

  it('leaves a colour it does not recognise untouched rather than mangling it', () => {
    expect(withAlpha('transparent', 0.5)).toBe('transparent');
  });

  it('derives the destructive tint of both palettes', () => {
    expect(getColors('light').destructiveMuted).toBe(withAlpha(paletteLight.destructive, 0.15));
    expect(getColors('dark').destructiveMuted).toBe(withAlpha(paletteDark.destructive, 0.15));
  });
});

describe('the scales are named views of the generated ones', () => {
  it('maps the spacing names onto the generated 4px scale', () => {
    expect(Space).toEqual({
      xs: spacing['1'],
      sm: spacing['2'],
      md: spacing['3'],
      lg: spacing['4'],
      xl: spacing['6'],
    });
  });

  it('maps the radius names onto the generated scale, plus the pill idiom', () => {
    expect(Radius.md).toBe(radius.md);
    expect(Radius.lg).toBe(radius.lg);
    expect(Radius.xl).toBe(radius.xl);
    // Not a design-system token: a scale of fixed radii cannot say "fully round".
    expect(Radius.pill).toBe(999);
  });
});
