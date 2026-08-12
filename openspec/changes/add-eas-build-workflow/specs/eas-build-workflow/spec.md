## ADDED Requirements

### Requirement: Manual-only build trigger
The EAS build workflow SHALL run only via `workflow_dispatch` and SHALL NOT run on `push` or `pull_request` events. It SHALL require a `platform` input (`ios`, `android`, or `all`) and a `profile` input (`development`, `preview`, or `production`).

#### Scenario: User dispatches a build
- **WHEN** a repo collaborator manually runs the workflow from the GitHub Actions UI with `platform=android` and `profile=preview`
- **THEN** the workflow runs `eas build --platform android --profile preview --non-interactive --no-wait`

#### Scenario: Push to master does not trigger a build
- **WHEN** a commit is pushed to `master`
- **THEN** the EAS build workflow does not run (only `ci.yml`'s checks run)

### Requirement: Non-blocking build submission
The workflow SHALL submit the build to EAS with `--no-wait`, so the GitHub Actions job completes once the build is queued on EAS's infrastructure rather than blocking until the cloud build finishes.

#### Scenario: Build is queued
- **WHEN** `eas build` is invoked by the workflow
- **THEN** the Actions job succeeds as soon as EAS accepts and queues the build, without waiting for compilation to finish
- **AND** actual build progress/result is checked via the Expo dashboard or `eas-cli`, not the Actions log

### Requirement: Non-interactive EAS authentication
The workflow SHALL authenticate to EAS using an `EXPO_TOKEN` repository secret, with no interactive login prompt at any point.

#### Scenario: Workflow run authenticates via secret
- **WHEN** the workflow job runs
- **THEN** `expo/expo-github-action` configures `eas-cli` using the `EXPO_TOKEN` secret
- **AND** the job does not pause for interactive Expo account login

### Requirement: Production Android builds use EAS-managed credentials
Production Android builds SHALL source signing credentials from EAS-managed remote storage (`eas.json` `build.production.android.credentialsSource: "remote"`), not from local, gitignored keystore files that only exist on a developer's machine.

#### Scenario: Production Android build triggered from CI
- **WHEN** the workflow is dispatched with `platform=android` (or `all`) and `profile=production`
- **THEN** `eas-cli` fetches the signing keystore from EAS-managed credential storage
- **AND** the build does not fail due to a missing local `credentials.json` or `.jks` file
