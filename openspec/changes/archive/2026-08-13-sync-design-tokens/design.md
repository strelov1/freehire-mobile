## Context

See `proposal.md` - Why. Relevant constraints:

- `freehire-mobile` and `hire` are separate git repositories with no shared workspace or package registry between them. The only thing we can assume is that a developer who wants to re-sync has both checked out locally.
- `hire/design-system/tokens/*.tokens.json` is DTCG-format JSON (`$value`/`$type`/`$description` per token), built by that repo's own `style-dictionary` pipeline into CSS custom properties. This change does not run or depend on that build — it reads the JSON sources directly.
- The mobile app has no `oklch` support (React Native color props take hex/rgb(a)/named colors), so color conversion has to happen at generation time, not at runtime.
- `src/constants/freehire.ts` is the existing hand-written token file this work is meant to eventually feed. This change stops at producing `tokens.generated.ts`; wiring `freehire.ts` to consume it is a separate, later change (see proposal Non-Goals).

## Goals / Non-Goals

**Goals:**
- A single command a developer runs locally, after pulling `hire` changes, to refresh `src/constants/tokens.generated.ts`.
- Deterministic, fully-typed output that covers every color/spacing/radius token in the source files (not just the subset currently hand-ported), so the generated file is immediately useful for tokens `freehire.ts` doesn't yet expose (e.g. `destructive`, `warning`).
- Fail closed: any token value the script doesn't know how to convert stops the run with a clear error, rather than emitting a guessed or blank value.

**Non-Goals:**
- No file-watching, git hooks, or CI integration. This is an explicit, human-triggered action.
- No general-purpose DTCG/style-dictionary reimplementation — only the token shapes actually present in `color.tokens.json`, `color-dark.tokens.json`, `spacing.tokens.json`, and `radius.tokens.json` today need to be supported.
- No attempt to keep `hire`'s exact token names as TypeScript identifiers verbatim — they're transformed by one fixed, documented naming rule (below), not preserved 1:1.

## Decisions

**Read source JSON directly, rather than `hire`'s built CSS output.**
Considered running `hire/design-system`'s own `pnpm build` and parsing `dist/tokens-light.css` / `tokens-dark.css`. Rejected: it requires `hire`'s dependencies installed and its build to be run (and current) as a precondition, adds a cross-repo process-execution step, and CSS custom-property parsing is more fragile than reading the JSON `$value` fields directly. Reading the JSON sources keeps this script self-contained — its only precondition is that `../hire` exists on disk.

**`culori` for color conversion.**
`culori` parses CSS color strings (including `oklch()`, with or without an alpha component) and can convert/format to hex and rgb(a). It's added as a `devDependency` — it runs only inside the Node script, never bundled into the RN app. Alternative considered: hand-rolling the oklch→sRGB math. Rejected as unnecessary risk (color math has easy-to-get-wrong edge cases like gamut clipping) for a solved problem a small, focused library already handles correctly.

**Minimal hand-written `calc()` evaluator, not a general expression parser.**
Every `calc()` value in the current radius tokens has the exact shape `calc(<rem-value> * <number>)` (e.g. `calc(0.625rem * 0.6)`). The script matches that one pattern with a regex, converts the rem operand to px, and multiplies. Any `calc()` that doesn't match this shape is treated as unsupported (see Requirement: Fail loudly). Alternative considered: pulling in a CSS `calc()` parsing library. Rejected as disproportionate for one multiplication pattern; revisit if the token source starts using addition, nesting, or other units.

**Naming rule: strip the file's own category prefix, then camelCase.**
Applied per source file so the generated identifiers read naturally in TS:
- `spacing.tokens.json`: token names are `spacing-0`, `spacing-1`, `spacing-4`, ... . Strip the `spacing-` prefix and use the remainder as a **numeric key** on the exported `spacing` object (`spacing[4]` → `16`), mirroring how the token scale already reads as a Tailwind-style numeric scale.
- `radius.tokens.json`: token names are `radius`, `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`. Strip the `radius`/`radius-` prefix; the bare `radius` token (no suffix) becomes the `DEFAULT` key. Exported as `radius.DEFAULT`, `radius.sm`, `radius.md`, `radius.lg`, `radius.xl`.
- `color.tokens.json` / `color-dark.tokens.json`: token names are already semantic (`background`, `card-foreground`, `brand-ring`, ...) with no category prefix to strip. Each is camelCased directly (`card-foreground` → `cardForeground`) and becomes a key on `paletteLight` / `paletteDark`.

**Output is a single generated file, not one file per token family.**
`tokens.generated.ts` exports `paletteLight`, `paletteDark`, `spacing`, `radius`, and their TS types from one file. Simpler to import from and to regenerate atomically (one file either reflects the latest sync or it doesn't — no partial-update states across multiple files).

## Risks / Trade-offs

- **`../hire` not present, or at a different relative path** (e.g. a differently-named checkout) → the script fails fast with a specific error naming the expected path, rather than silently skipping the sync or producing a stale/empty file.
- **Upstream token shape changes** (new `calc()` pattern, a color format `culori` can't parse, a token family restructured) → the script throws naming the offending token and file instead of guessing; a human updates the script's conversion logic before re-running.
- **Generated file goes stale between manual runs** → by design for this change (see proposal Non-Goals: no CI/build-time automation). The risk of staleness is accepted in exchange for not requiring every contributor to have `hire` checked out just to build the mobile app. A future change can revisit automation once there's evidence this manual step is actually being forgotten.
- **`tokens.generated.ts` and `freehire.ts` now both exist with overlapping token names but aren't wired together** → until the follow-up change rewires `freehire.ts`, there are briefly two sources of the same values in this repo. Mitigated by the `tokens.generated.ts` header explicitly stating it's generated and by keeping this change small enough that the follow-up isn't left dangling long.

## Migration Plan

Purely additive: new script, new test file, new generated file, one new devDependency, one new `package.json` script entry. Nothing existing is imported, modified, or deleted, so there's no rollback concern beyond reverting the commit.
