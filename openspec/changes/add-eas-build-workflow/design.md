## Context

`ci.yml` already establishes the pattern for this repo's GitHub Actions: `ubuntu-latest`, `actions/checkout@v7`, `actions/setup-node@v7` (node 22, `cache: npm`), `npm ci`. EAS Build itself runs on Expo's cloud infrastructure, not on the GitHub runner, so the runner's only job is to invoke `eas-cli` with the right credentials and wait (or not) for a result — no macOS runner is needed even for iOS builds.

`eas.json` currently has three build profiles (`development`, `preview`, `production`) and pins `build.production.android.credentialsSource` to `"local"`, pointing at a keystore (`credentials/freehire-release.jks`) and `credentials.json` that are gitignored and exist only on the developer's machine. Any CI runner checking out a fresh clone has neither file, so a production Android build would fail today.

## Goals / Non-Goals

**Goals:**
- Let anyone with repo write access trigger an EAS build for any platform/profile combination from the GitHub Actions UI, without a local Expo/EAS setup.
- Make production Android buildable from CI by moving its credentials source off the single local machine.

**Non-Goals:**
- Automatic build triggers on push/merge (explicitly manual-only, per user decision).
- EAS Update / OTA publishing.
- `eas submit` / store submission automation.
- Migrating development or preview Android credentials (they're not `local`-sourced and are unaffected).
- Actually uploading the keystore to EAS or creating the `EXPO_TOKEN` GitHub secret — both are manual, out-of-band steps the user performs themselves; this change only makes the repo config assume they've been done.

## Decisions

**Workflow trigger: `workflow_dispatch` only, with `platform` and `profile` choice inputs.**
Alternative considered: auto-trigger a preview build on every push to `master`. Rejected — user explicitly chose manual-only to keep full control over when cloud build minutes are spent.

**Build action: `expo/expo-github-action@v8` + `eas build --non-interactive --no-wait`.**
This is Expo's own maintained action for installing/authenticating `eas-cli` in CI; using it instead of hand-rolling `npm install -g eas-cli` avoids tracking eas-cli version compatibility ourselves. `--no-wait` returns as soon as the build is queued instead of blocking the runner (and consuming Action minutes) for the full cloud build duration; build status is checked via the Expo dashboard or CLI, not the Action log.

**Auth: `EXPO_TOKEN` repo secret.**
Standard mechanism for `expo-github-action` / `eas-cli` non-interactive auth. No alternative considered — this is the only supported non-interactive auth path for EAS CLI.

**Android production credentials: `credentialsSource` `"local"` → `"remote"`.**
Alternative considered: keep `"local"` and pass the keystore into CI via base64-encoded GitHub Secrets, reconstructing the files in a workflow step. Rejected per user's earlier decision (during brainstorming) — EAS-managed remote credentials avoid duplicating secret material across two systems (GitHub Secrets and the local machine) and let `eas credentials` handle rotation/backup, at the cost of a one-time manual `eas credentials` upload the user must run before this workflow's first production Android build.

**Runner: `ubuntu-latest` for all platforms, including iOS.**
EAS Build compiles on Expo's own servers; the Action only submits the build job and polls/waits. No native toolchain runs on the GitHub runner, so there's no reason to pay for a macOS runner here (unlike a workflow that builds locally with `expo run:ios`).

## Risks / Trade-offs

[Production Android builds triggered via this workflow will fail until the user manually runs `eas credentials` to upload the existing keystore to EAS] → Document this as a prerequisite in the workflow's own comments and in the task list; not blocking for `ios`/`android` `development`/`preview` builds, which don't depend on this credential migration.

[`--no-wait` means the Actions run always reports success once the build is *queued*, even if the cloud build later fails] → Acceptable trade-off given this is a manual, developer-triggered workflow — the developer checks the Expo dashboard/CLI for actual build status, same as they would running `eas build` locally.

[Anyone with write access can trigger a production build] → Acceptable for now given team size; no additional approval gating (e.g. GitHub Environments with required reviewers) is in scope for this change.

## Migration Plan

1. Land `.github/workflows/eas-build.yml` and the `eas.json` credentials change together (the workflow is only fully functional once both exist).
2. User creates the `EXPO_TOKEN` secret in GitHub repo settings (manual, out-of-band).
3. User runs `eas credentials` locally to upload the existing production Android keystore to EAS-managed storage (manual, out-of-band) — required before the first production Android build via this workflow.
4. No rollback complexity: reverting the `eas.json` line restores local-credentials behavior for anyone still building production Android locally with the existing keystore file.

## Open Questions

None outstanding — scope, trigger, credentials approach, and runner choice were all settled with the user during brainstorming.
