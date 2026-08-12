# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Guardrails

`npm run lint` (eslint-config-expo) and `npx tsc --noEmit` (strict, incl.
`noUncheckedIndexedAccess`) gate CI (`.github/workflows/ci.yml`) on every
push/PR to `master`. Pre-commit: [lefthook](https://github.com/evilmartians/lefthook)
(`go install github.com/evilmartians/lefthook@latest`, then `lefthook install`
once per clone) runs eslint + tsc on staged files.
