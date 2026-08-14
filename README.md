# freehire mobile

Expo SDK 57 client for browsing FreeHire jobs and using the existing cookie-based v1 authentication flow.

## Requirements

- Node.js 20 LTS or newer
- npm 10 or newer
- Expo Go for JavaScript-only development, or an EAS development build for native-module work

Install dependencies:

```bash
npm install
```

## Environment

Copy `.env.example` to `.env.local` for local development and set:

```dotenv
EXPO_PUBLIC_API_BASE=http://localhost:8080
```

`EXPO_PUBLIC_*` values are compiled into the app and are public. Never put private keys, signing passwords, OAuth client secrets, cookies, or encryption keys in them.

The API value must be an origin only. Development permits `http://localhost`; preview and production require HTTPS and should use `https://freehire.me`. Preview/production configuration fails before build when the value is missing or invalid.

## Development and checks

```bash
npm start
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo config --type public
npx expo-doctor
```

Expo Go is enough for the current FE-1+2 JavaScript flow. The `development` EAS profile includes `expo-dev-client` so future native integrations can use a development build.

## EAS builds

The app is linked to owner `freehire-team`, project `399c136d-96e9-4e2b-bf43-81a4eb00d8a9`, with iOS and Android identifier `me.freehire.mobile`.

Set the public API origin in each EAS environment, then build with the matching profile:

```bash
eas env:create --name EXPO_PUBLIC_API_BASE --value https://freehire.me --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_API_BASE --value https://freehire.me --environment production --visibility plaintext
eas build --profile development --platform android
eas build --profile preview --platform all
eas build --profile production --platform all
```

Android release signing remains owner-controlled. `credentials.json`, JKS files, Apple `.p8` keys, and other signing material are ignored and must never be committed.

## Authentication boundaries

- FE-1+2 uses the backend v1 cookie session endpoints and existing browser OAuth handshake.
- The backend redirects mobile OAuth to `freehiremobile://auth-callback`; provider callback URLs remain the backend `/api/v1/auth/oauth/<provider>/callback` URLs.
- FE-4/FE-5 will migrate to BE-2 PKCE and native Sign in with Apple. Do not add Apple private keys to this repository.
- RevenueCat, push registration, recent authentication, connected identities, and deletion UI are separate changes.

## Owner and release gates

- Keep OAuth provider console callback registrations aligned with the deployed backend origin.
- Review the resolved public Expo config for every EAS environment before building.
- `https://freehire.me/privacy` is the canonical privacy page.
- Publish `https://freehire.me/terms` before a terms link ships.
- Publish `https://freehire.me/delete-account` and finish BE-3/FE-7 before store submission or exposing deletion UI.
- Complete security review and real-device cookie/session testing before release. Local tests and cloud build success are not device proof.
