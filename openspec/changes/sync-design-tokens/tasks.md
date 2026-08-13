## 1. Setup

- [x] 1.1 Add `culori` as a devDependency in `package.json`
- [x] 1.2 Add the `"sync-tokens": "node ./scripts/sync-design-tokens.mjs"` script entry to `package.json`
- [x] 1.3 Create fixture DTCG token JSON files under `scripts/__fixtures__/` (small `color.tokens.json`, `color-dark.tokens.json`, `spacing.tokens.json`, `radius.tokens.json` covering: a plain hex color, an opaque oklch color, an oklch color with alpha, an alias reference, a plain rem dimension, and a `calc(<rem> * <number>)` dimension) for use by the tests below

## 2. Value conversion primitives

- [x] 2.1 Implement and test rem → px conversion (16px base)
- [x] 2.2 Implement and test the `calc(<rem-value> * <number>)` evaluator, including that any other `calc()` shape throws a clear error
- [x] 2.3 Implement and test opaque `oklch()` → hex conversion using `culori`
- [x] 2.4 Implement and test `oklch()` with alpha → rgba conversion using `culori`
- [x] 2.5 Implement and test alias resolution (`{token-name}` → that token's resolved value within the same file)
- [x] 2.6 Implement and test the naming rule: strip a file's category prefix and camelCase the remainder for `spacing`/`radius` tokens (numeric keys for spacing, `DEFAULT` for the bare `radius` token); camelCase kebab-case names directly for color tokens

## 3. Source reading and error handling

- [x] 3.1 Implement reading `color.tokens.json`, `color-dark.tokens.json`, `spacing.tokens.json`, `radius.tokens.json` from `../hire/design-system/tokens/`
- [x] 3.2 Test: missing `../hire/design-system/tokens/` directory exits non-zero with an error naming the expected path
- [x] 3.3 Test: a token value the converters can't handle (unsupported `calc()`, unresolved alias, unparseable color) exits non-zero with an error naming the offending token and source file, and no file is written

## 4. Code generation

- [x] 4.1 Implement generating `tokens.generated.ts` content: header comment (auto-generated, do-not-edit, names the source path), `GeneratedPalette` type, `paletteLight`, `paletteDark`, `spacing`, `radius` exports
- [x] 4.2 Test: end-to-end happy path — given the Section 1.3 fixtures, running the generator produces the expected `tokens.generated.ts` content (assert against a known-good snapshot/string)
- [x] 4.3 Wire up `scripts/sync-design-tokens.mjs` as the CLI entry point that reads real `../hire/design-system/tokens/`, runs the pipeline, and writes `src/constants/tokens.generated.ts`

## 5. Verification

- [x] 5.1 Run `npm run sync-tokens` against the real `../hire/design-system` checkout and confirm `src/constants/tokens.generated.ts` is produced
- [x] 5.2 Manually diff the generated color values against the current hand-written values in `src/constants/freehire.ts` — **found real drift, not just rounding noise**: most oklch-derived grays/darks differ meaningfully from the hand-written hex (e.g. `foreground` light: hand `#1c1c1c` vs generated `#070707`; `mutedForeground` light: hand `#6f6f6f` vs generated `#505050`). Independently re-derived the OKLab→linear-sRGB→gamma math by hand for several of these and it matches the generated values, not the hand-written ones — the generated output is the spec-correct conversion. Only pure-hex tokens (the light-mode `brand-*` values) match exactly, since those pass through unconverted. Not fixing `freehire.ts` here — out of scope per proposal.md Non-Goals — but this is a concrete argument for prioritizing that follow-up change.
- [x] 5.3 Confirm `tsc --noEmit` passes with the new generated file in place — `tokens.generated.ts` itself introduces zero new errors. `tsc --noEmit` does exit non-zero, but from two pre-existing, unrelated errors (`src/components/animated-icon.web.tsx`, `src/constants/theme.ts`) present on `master` before this change and untouched by it.
