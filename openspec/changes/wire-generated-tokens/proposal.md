## Why

`design-token-sync` exists so the app's colours "stay in sync instead of drifting apart through
hand-editing". The script runs, `src/constants/tokens.generated.ts` is written and committed — and
nothing in `src/` imports it. Every component reads `src/constants/freehire.ts`, a second palette
written by hand before the sync existed and maintained by hand ever since.

So the drift the sync was built to end has been happening the whole time, unobserved. Comparing the
two files: **seven** of the light theme's colours and **twelve** of the dark theme's sixteen have
wandered off the design system. The dark background is `#191a15` here against `#0d0e0b` in the
system; the brand, its foreground, its strong and muted tones and its ring are all different values.
The radius scale has drifted by a whole step — this app's `md` is the system's `lg`, and its `xl` is
16 against the system's 14.

The most recent addition to the hand-written file was made by the change three commits ago, which
copied the amber `warning` tones across by hand while noting that the generated file had no
importer. That is the same mistake one more time, which is a good sign it is the file that needs
fixing rather than the discipline.

## What Changes

- **`freehire.ts` reads the generated tokens** instead of holding its own copy of them. The colours
  become the design system's, exactly.
- **The scales stay semantically named.** `Space.lg` and `Radius.xl` remain — they are this app's
  names over the system's values, and a screen reads better for them. `Radius.pill` stays as a local
  idiom: "fully round" is not something a scale of fixed radii can express.
- **One colour is derived rather than read.** `destructiveMuted` has no token: the web writes it
  inline as `bg-destructive/10`, an opacity modifier React Native has no equivalent of. It is
  computed from `destructive`, and that computation is the only value in the file with a test.
- **A missing scale step fails at load**, naming the token and the command that would restore it,
  rather than spreading `undefined` through the layout as a missing margin.

**This changes how the app looks**, and deliberately: the dark theme becomes the design system's
darker background, the brand tones shift to their current values, and corners are slightly tighter.
That is what "in sync" means; the alternative is a second design system that happens to live in a
phone.

## Capabilities

### Modified Capabilities

- `design-token-sync`: the capability gains the half it was missing — not just generating the token
  file, but being the thing the app actually reads.

## Impact

- **Source:** `src/constants/freehire.ts` (now a view over the generated file), and its first test.
- **Visual:** every screen, by the amounts listed above. No layout changes beyond the radius step.
- **Not in this change:** the handful of literal colours still living in components (`auth.tsx`'s
  icon defaults, `BrandMark`, `AppSymbol`'s fallback, `constants/theme.ts` from the Expo template).
  They predate this work and are their own tidy-up.
