## Why

`src/constants/freehire.ts` hand-ports color, spacing, and radius values from the web app's Tailwind theme — each color is an `oklch()` value manually converted to hex, with a comment noting the source. `hire` has since grown a formal `design-system` package (`hire/design-system/tokens/*.tokens.json`, DTCG format, built with style-dictionary) that is becoming the real source of truth for those same values. The hand-ported copy in this repo has no mechanism to catch drift when a token changes upstream — a designer can change `hire`'s brand color and this app would silently keep rendering the old one.

## What Changes

- Add a local, manually-invoked script (`scripts/sync-design-tokens.mjs`, run via `npm run sync-tokens`) that reads `../hire/design-system/tokens/{color,color-dark,spacing,radius}.tokens.json` directly and regenerates `src/constants/tokens.generated.ts`.
- The script resolves token aliases (e.g. `ring: "{brand-ring}"`), converts `oklch()` color values to hex/rgba, and converts `rem`/`calc()` dimension values to px numbers.
- `tokens.generated.ts` exports the **full** color token set from `color.tokens.json` (not just the subset `freehire.ts` currently uses), camelCased, plus `spacing` and `radius` objects.
- Scope for this change is color + spacing + radius only. `typography`, `shadow`, `motion`, and `z-index` tokens exist in `hire/design-system` but are explicitly out of scope here — they don't map 1:1 onto React Native and aren't needed yet.

Non-goals (explicitly deferred to a later change):
- Rewiring `freehire.ts` to actually import from `tokens.generated.ts` — it stays hand-written for now; this change only makes the generated values available.
- Migrating components off hardcoded hex colors (e.g. `#dc2626` in `account.tsx`/`auth.tsx`) onto generated tokens like `destructive`/`warning`.
- Any CI or build-time automation of the sync — this is a manually-invoked local script only, since `../hire` is not guaranteed to be present on every machine or in CI.
- Removing the unused legacy `src/constants/theme.ts` / `src/hooks/use-theme.ts` (pre-existing, unrelated duplication, noted but out of scope).

## Capabilities

### New Capabilities
- `design-token-sync`: a local script that reads DTCG token JSON from `../hire/design-system`, resolves aliases, converts oklch colors and rem/calc dimensions, and generates a typed `tokens.generated.ts` file for the mobile app to consume.

### Modified Capabilities
- none <!-- no existing spec in this repo covers design tokens -->

## Impact

- **This repo:** new `scripts/sync-design-tokens.mjs` + `scripts/sync-design-tokens.test.mjs`; new `src/constants/tokens.generated.ts` (generated output, committed like any other source file); `culori` added as a devDependency; `"sync-tokens"` script added to `package.json`. No existing runtime code path changes — `tokens.generated.ts` is not yet imported anywhere.
- **`hire` repo:** none — read-only consumer of its `design-system/tokens/*.tokens.json` files.
- **Cross-repo assumption:** the script assumes `../hire` is checked out as a sibling directory. It is never run automatically (not in `npm start`, not in CI) — only on demand when someone wants to refresh the generated file after tokens change upstream.
