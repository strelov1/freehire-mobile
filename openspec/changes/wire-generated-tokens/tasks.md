## 1. The palette

- [x] 1.1 `src/constants/freehire.ts` — read `paletteLight`/`paletteDark` from
      `tokens.generated.ts`; `FreehirePalette` becomes `GeneratedPalette` plus the one derived
      colour. Delete the hand-written copies.
- [x] 1.2 `withMutedAlpha(color)` — the derived `destructiveMuted`, handling both shapes the
      generator emits (`#rrggbb` and `rgba(...)`) and leaving anything else untouched rather than
      mangling it.
- [x] 1.3 `Space` and `Radius` keep their semantic names, reading the generated scales through a
      `step()` that throws — naming the token and `npm run sync-tokens` — rather than yielding
      `undefined` under `noUncheckedIndexedAccess`.

## 2. Tests

- [x] 2.1 `src/constants/freehire.test.ts` — the palette is the generated one in both themes, the
      scheme fallback, the derived colour in both directions, and the scales as named views.

## 3. The literals left behind

- [x] 3.1 `withMutedAlpha` generalises to `withAlpha(color, alpha)`, since the palette is not the
      only place a token is needed at partial opacity.
- [x] 3.2 `src/components/RealityBadge.tsx` — the warn chip drops its four hand-picked ambers
      ("Amber isn't in the freehire palette", which stopped being true) for the caution tone. The
      palette resolves the readable variant per theme, so the branch on `scheme` goes too.
- [x] 3.3 `src/app/account/delete.tsx` and `src/components/ConfirmationModal.tsx` — the label on a
      destructive fill takes `destructiveForeground` instead of assuming white reads on it.
- [x] 3.4 Left as they are, with reasons: the Google and Apple brand colours (their guidelines fix
      them), `ConfirmationModal`'s shadow, `AppSymbol`'s last-resort default, `auth.tsx`'s icon
      parameter defaults (every call site passes a colour), and `constants/theme.ts` with its
      `themed-*` components — an Expo-template palette living beside this one, whose merge is its
      own change.

## 4. Verification

- [x] 4.1 `npm run lint` and `npx tsc --noEmit` clean.
- [x] 4.2 Unit tests pass: 526 across 56 suites.
- [x] 4.3 By eye on an iOS simulator, both themes: the design system's darker background and olive
      brand read as intended, chips and buttons keep their contrast, and nothing depended on the
      old values.
