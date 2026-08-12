## 1. Android production credentials

- [x] 1.1 Change `eas.json` `build.production.android.credentialsSource` from `"local"` to `"remote"`.
- [x] 1.2 Verify `eas.json` is still valid JSON after the edit (`node -e "JSON.parse(require('fs').readFileSync('eas.json','utf8'))"`).

## 2. EAS build workflow

- [x] 2.1 Create `.github/workflows/eas-build.yml` with a `workflow_dispatch` trigger only (no `push`/`pull_request`), declaring `platform` (choice: `ios`/`android`/`all`) and `profile` (choice: `development`/`preview`/`production`) inputs.
- [x] 2.2 Add the job on `ubuntu-latest`: `actions/checkout`, `actions/setup-node` (node 22, `cache: npm`), `npm ci` — matching the pattern already used in `ci.yml`.
- [x] 2.3 Add `expo/expo-github-action@v8` (authenticated via `secrets.EXPO_TOKEN`) followed by a step running `eas build --platform ${{ inputs.platform }} --profile ${{ inputs.profile }} --non-interactive --no-wait`.
- [x] 2.4 Add a short comment in the workflow noting the two manual prerequisites: the `EXPO_TOKEN` repo secret must exist, and (for `platform=android`/`all` + `profile=production`) the keystore must already be uploaded to EAS via `eas credentials`.

## 3. Validation

- [x] 3.1 Validate the new workflow's YAML syntax (e.g. `actionlint` if available, otherwise `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/eas-build.yml'))"`).
- [x] 3.2 Confirm `ci.yml`'s existing push/PR checks are untouched (`git diff` shows no changes to `.github/workflows/ci.yml`).
- [x] 3.3 Update `AGENTS.md` guardrails section with a one-line pointer to the new workflow and its two manual prerequisites (`EXPO_TOKEN` secret, `eas credentials` upload for production Android).
