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

## 3. Verification

- [x] 3.1 `npm run lint` and `npx tsc --noEmit` clean.
- [x] 3.2 Unit tests pass: 524 across 56 suites.
- [ ] 3.3 By eye on a device: the dark theme's new background and brand tones, and the tighter
      corners, read as intended. Needs a simulator — not done in this session. The values are the
      design system's by construction; what a screenshot would confirm is that nothing depended on
      the old ones.
