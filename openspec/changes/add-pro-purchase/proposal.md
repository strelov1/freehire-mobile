## Why

The app cannot take money. `README.md` has said "RevenueCat and push registration remain
separate changes" since the first release, and `src/app/account/delete.tsx:25-26` already
carries Apple's Guideline 5.1.1 disclosure about store subscriptions surviving account
deletion — a disclosure about a subscription nobody can buy here.

Meanwhile the backend now sells one. `freehire.me` has a Free and a Pro plan, `users.pro_until`
decides every allowance, and the `add-store-purchases` change gives it a second payment
provider: RevenueCat, fronting the App Store and Google Play. That provider exists **because
of this app** — Apple's guideline 3.1.1 and Google Play's Payments policy require digital
content consumed in an app to be sold through in-app purchase, so linking out to the web
checkout is not an option a review would pass.

What is left is the client half: a paywall, a purchase, and an honest answer about what plan
the signed-in person is on.

## What Changes

- **A signed-in user can buy Pro from the Profile tab.** A new screen shows the current plan,
  the monthly and annual packages read from RevenueCat's offerings, and a purchase button.
- **The plan comes from the server, never from the SDK.** `GET /api/v1/me/plan` is the only
  thing that decides whether the app shows Pro. `CustomerInfo` drives the purchase flow and
  nothing else — gating on it would disagree with the web, with the API's own 402, and with a
  refund the store processed an hour ago.
- **A completed purchase is confirmed in one round trip.** The app calls
  `POST /api/v1/billing/revenuecat/sync` and refetches the plan, rather than waiting on a
  webhook that arrives seconds later — or, if it is one of the ones that never arrives, up to
  an hour later.
- **RevenueCat is identified with our own `users.id`.** `Purchases.logIn` and `logOut` ride
  the same session transition that already clears private cache (`authStore.tsx:95-100`), so
  a purchase cannot leak between two accounts on one device.
- **Restore purchases and a link to the store's own subscription management.** Both are
  required by Apple; the store URLs already exist in `delete.tsx` and move to one place.
- **`pro_source` decides what the screen offers.** A subscriber who bought on the web through
  Stripe is shown their plan and where to manage it, never an in-app purchase — selling that
  would charge them twice for one plan, and telling them to cancel on a web page violates
  Apple's rules.
- **The app stops being buildable in Expo Go for this surface.** `react-native-purchases` is a
  native module; in Expo Go the SDK falls back to Preview API Mode with JS mocks, so the app
  still runs and simply cannot sell.

## Capabilities

### New Capabilities

- `pro-purchase`: how a store purchase is made and confirmed in the app, what decides whether
  the app believes somebody is Pro, how the RevenueCat identity is tied to the signed-in
  account and torn down on sign-out, what the paywall shows for each `pro_source`, and how
  the whole surface behaves without credentials or without a development build.

### Modified Capabilities

- `mobile-profile-view`: the Profile tab gains a plan row — the entry point to the paywall
  and the only place the app states what plan the user is on.

## Impact

- **Dependencies:** `react-native-purchases` (10.9.0). No config plugin; autolinking covers
  both platforms. Native modules already require a development build here — Sign in with
  Apple does too.
- **App config:** two new public values, `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and
  `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, validated in `app.config.ts` the way
  `EXPO_PUBLIC_API_BASE` already is: a preview or production build without them fails before
  it starts. RevenueCat's platform keys are public by design; the secret `sk_` key stays on
  the server.
- **Source:** a new `src/features/billing/` beside `src/features/auth/`, one screen under
  `src/app/account/`, a row in `(tabs)/profile.tsx`, a `Stack.Screen` in `_layout.tsx`, and a
  `Purchases.logIn`/`logOut` call in the existing session transition.
- **Release process:** In-App Purchase capability on the iOS App ID invalidates the
  provisioning profile, so an interactive `eas credentials -p ios` is needed before the next
  build — CI cannot do it (`AGENTS.md`). And Android IAP cannot be tested through the current
  pipeline at all: `eas.json` ships Android previews as an APK to Firebase, and Google Play
  Billing only works for a build installed from Play. `docs/releasing.md` changes.
- **Not in this change:** intercepting the API's 402 to raise the paywall (no screen in this
  app calls a metered endpoint yet); RevenueCat's remote-configured Paywalls and their A/B
  testing; purchases in the Expo web build; promotional offers, win-back and introductory
  trials; and any change to what Pro actually unlocks, which is the backend's business.
