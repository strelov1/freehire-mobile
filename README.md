# freehire mobile

Expo SDK 57 client for browsing FreeHire jobs, signing in, and managing the account.

## Requirements

- Node.js 20.19.4+, 22.13+, 24.3+, or 25+ — the range React Native 0.86 supports
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

Sign in with Apple is a native module, so it needs a development build rather than Expo Go; the `development` EAS profile includes `expo-dev-client` for that. The rest of the app still runs in Expo Go.

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

- The session rides the backend's v1 cookie endpoints; sign-in itself uses the v2 PKCE OAuth handshake and native Sign in with Apple.
- Browser OAuth starts at `/api/v2/auth/oauth/<provider>/start` with an S256 challenge and returns through `freehiremobile://auth-callback`. The verifier never leaves the device, which is what protects that custom scheme.
- Universal links are deliberately not configured yet: they need an `apple-app-site-association` file on `freehire.dev`/`freehire.me` plus an in-app route that completes the exchange. Turning on a verified App Link before that would strand the handshake.
- Apple sign-in binds `sha256(raw_nonce)` into the credential and sends the raw nonce to the backend for verification. Do not add Apple private keys to this repository.
- Password change, identity unlinking, and account deletion sit behind a five-minute recent-auth window; the server is the authority and answers `428` when it has lapsed.
- RevenueCat and push registration remain separate changes.

## Owner and release gates

- Keep OAuth provider console callback registrations aligned with the deployed backend origin.
- Review the resolved public Expo config for every EAS environment before building.
- `https://freehire.me/privacy` is the canonical privacy page.
- Publish `https://freehire.me/terms` before a terms link ships.
- Publish `https://freehire.me/delete-account` before store submission; the in-app deletion flow is live and Apple expects a web equivalent alongside it.
- Create `EXPO_PUBLIC_API_BASE` in the preview and production EAS environments before the first build on those profiles — `app.config.ts` fails the build when it is missing.
- Complete security review and real-device cookie/session testing before release. Local tests and cloud build success are not device proof.
