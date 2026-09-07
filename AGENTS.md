# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Guardrails

`npm run lint` (eslint-config-expo) and `npx tsc --noEmit` (strict, incl.
`noUncheckedIndexedAccess`) gate CI (`.github/workflows/ci.yml`) on every
push/PR to `master`. Pre-commit: [lefthook](https://github.com/evilmartians/lefthook)
(`go install github.com/evilmartians/lefthook@latest`, then `lefthook install`
once per clone) runs eslint + tsc on staged files.

`.github/workflows/eas-build.yml` triggers an EAS Build manually (platform +
profile inputs). Requires the `EXPO_TOKEN` repo secret; production Android
additionally requires the release keystore to already be uploaded to EAS via
`eas credentials` (`eas.json` points production Android at remote credentials).

## Releasing

Read [docs/releasing.md](docs/releasing.md) before touching a workflow, a build
profile, or anything under `ios`/`android` in `app.config.ts`.

The short version: a `v*` tag ships both platforms **to testers** (TestFlight +
Firebase) via `release.yml`, which calls `eas-build.yml` once per destination.
They use different profiles on purpose — iOS `production`, Android `preview` —
because Firebase only takes an APK and `production` emits an `.aab`. Neither
store is wired for public release.

A third job submits Android to Google Play on the `production` profile. It is
gated on the repository variable `PLAY_SUBMIT_ENABLED` and is **off**: the Play
app record, the first manual `.aab` upload and the service account on EAS do
not exist yet. Adding an entitlement to `app.config.ts`
invalidates the iOS provisioning profile and needs an interactive
`eas credentials -p ios` before the next build; CI cannot do it.
