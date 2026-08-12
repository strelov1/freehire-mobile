## Why

CI already gates `master` with lint/typecheck/test (`.github/workflows/ci.yml`), but there is no way to produce an installable EAS build from CI — every build is triggered locally via `eas build`. A manually-triggered GitHub Actions workflow lets anyone with repo access cut a build (dev/preview/production, either platform) without a local Expo/EAS setup, and removes the current production Android dependency on a keystore file that only exists on one machine.

## What Changes

- Add `.github/workflows/eas-build.yml`: a `workflow_dispatch`-only workflow with `platform` (`ios` / `android` / `all`) and `profile` (`development` / `preview` / `production`) inputs that runs `eas build --non-interactive --no-wait` via `expo/expo-github-action`, authenticated with an `EXPO_TOKEN` repo secret (secret creation is a manual, out-of-band step for the user).
- **BREAKING**: Change `eas.json` `build.production.android.credentialsSource` from `"local"` to `"remote"`, so production Android builds pull the signing keystore from EAS-managed credentials instead of the gitignored local `credentials.json` / `credentials/freehire-release.jks`. Uploading the existing keystore to EAS via `eas credentials` is a manual, out-of-band step for the user — required before this workflow can produce a working signed production Android build.

## Capabilities

### New Capabilities
- `eas-build-workflow`: manually-triggered GitHub Actions workflow that runs EAS Build for a chosen platform/profile combination.

### Modified Capabilities
(none — no existing specs in this repo yet)

## Impact

- Affected files: `.github/workflows/eas-build.yml` (new), `eas.json` (credentialsSource change).
- Affected systems: GitHub Actions (new workflow, needs `EXPO_TOKEN` secret), EAS (production Android credentials must be migrated from local to remote before first production build via this workflow).
- No impact on the existing `ci.yml` checks workflow or on local `eas build` usage for development/preview profiles.
