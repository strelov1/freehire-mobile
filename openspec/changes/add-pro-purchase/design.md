## Context

The backend half of this feature landed first, in `../hire` as `add-store-purchases`, and it
fixes the contract this change builds against:

- `GET /api/v1/me/plan` answers `{ plan, resets_at, pro_until?, pro_source?, allowances[] }`.
  `pro_source` is `stripe`, `revenuecat` or `granted`, present only while the plan is live.
- `POST /api/v1/billing/revenuecat/sync` re-reads the caller's own store subscription and
  writes their source column. It names nobody: the account is the session's, and a user id in
  the body is ignored. Rate-limited to 10 a minute per caller.
- RevenueCat addresses an account by `app_user_id`, which IS `users.id`. Nothing else binds
  the two.
- `users.pro_until` is derived from three sources, so a store subscription and a web one
  compose rather than overwrite.

Three facts about this app shape the rest.

**The session is the server's.** Auth rides a cookie plus a `sessionEpoch`
(`src/lib/transport.ts`), not a client-held token, and `authStore.tsx:100` clears private
cache on every identity transition. Anything tied to a user — including a RevenueCat identity
— has to hang off that same transition or it outlives the user it belongs to.

**Native modules already need a development build.** Sign in with Apple does, and the
`development` EAS profile carries `expo-dev-client` for it. Adding another native module
changes nothing about how the project is built, only about what fails in Expo Go.

**`/ios` and `/android` are gitignored.** The project is on Continuous Native Generation, so
every native requirement is expressed through `app.config.ts`. `react-native-purchases` needs
no config plugin — autolinking is enough — but the iOS In-App Purchase capability is not
something CNG can grant, and that is the release-process cost recorded below.

## Goals / Non-Goals

**Goals:**

- A signed-in user can buy Pro on either platform and see it take effect without waiting.
- The app never claims a plan the server does not agree with.
- A purchase cannot be attributed to the wrong account, including on a shared device.
- A Stripe subscriber is never sold the same plan a second time.
- Everything that can be tested without a store is tested without a store.

**Non-Goals:**

- Deciding what Pro unlocks. That is `plan-limits` in the backend, and this app calls no
  metered endpoint yet.
- Intercepting 402 to raise the paywall. There is nothing here to intercept; the seam is
  noted rather than built.
- RevenueCat's hosted Paywalls, and the web build.
- Anonymous purchases. A purchase must attach to an account, so the button sends a signed-out
  visitor to `/auth` first.

## Decisions

### The server is the only source of truth about the plan

`GET /me/plan` decides whether the app shows Pro. `CustomerInfo` from the SDK is used for the
purchase flow — what is being sold, whether a purchase succeeded, whether one was cancelled —
and never to gate.

The temptation is real: the SDK has the answer locally and instantly, and gating on it would
be one line. It is wrong for three reasons that all cost more than the line saves. The web
and the app share one plan, and only the server sees both. The API answers 402 from the
server's view, so a client that disagreed would show Pro over a refusal. And a refund
processed in the store an hour ago is already in the server's column and not necessarily in a
cached `CustomerInfo`.

*Alternative considered.* An optimistic window — believe the SDK for a minute after a
purchase, then defer to the server. It buys a smoother second or two and costs a second
notion of "is Pro" that every screen must then know about. The sync route closes the same gap
without one.

### A purchase is confirmed by calling sync, not by waiting

On a successful `purchasePackage`, the app calls `POST /billing/revenuecat/sync` and refetches
the plan. If the server still disagrees, it retries with a bounded backoff and then says so
plainly: the money is taken, the access is coming, and the reconciler will finish the job.

This is the whole reason the sync route exists. A purchase completes on the device and the
webhook arrives afterwards; RevenueCat stops retrying 80 minutes in, and the reconciler runs
hourly. Without the round trip, a paid subscriber can sit in front of a paywall.

### RevenueCat identity is tied to the session transition, not to a screen

`Purchases.logIn(String(user.id))` and `Purchases.logOut()` go where `clearPrivateUserData`
already lives (`authStore.tsx:95-100`). Not in the paywall screen's effect, and not at app
start.

The failure this prevents is specific: two accounts on one device. If the identity is set
when the paywall opens, a user who signs out and back in as somebody else keeps the previous
`app_user_id` until they happen to visit that screen — and a purchase in between is attached
to the wrong account, at RevenueCat, permanently. Tying it to the transition that already
exists for exactly this reason means there is one place to get right.

### One module owns the SDK import

`src/features/billing/purchases.ts` is the only file that imports `react-native-purchases`,
following `src/lib/notifications.ts:17`: a `getPurchases()` that returns `null` where the
module cannot work. Everything else — the offering model, the screen, the hooks — is ordinary
TypeScript that a jest test can drive without a native module, which is how `push.test.ts`
already tests notification handling.

In Expo Go the SDK does not throw; it enters Preview API Mode and returns JS mocks. So the
guard is about the web build and about honest failure, not about crashes.

### `pro_source` decides what the screen shows

| `pro_source` | What the screen offers |
| --- | --- |
| absent (free) | The packages, and a purchase button |
| `revenuecat` | The plan, its expiry, and a link to the store's own subscription management |
| `stripe` | The plan, its expiry, and where it is managed — **no purchase button** |
| `granted` | The plan and its expiry, nothing to buy or manage |

The `stripe` row is a store-rules requirement rather than a nicety. Offering an in-app
purchase to somebody already paying through Stripe charges them twice for one plan, and Apple
forbids directing an in-app subscriber to a web page to cancel — so the app must know which
kind it is looking at before it says anything about cancelling.

### Keys are public and validated at build time

RevenueCat's platform keys (`appl_…`, `goog_…`) are meant to ship in the binary. They ride as
`EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, resolved in
`app.config.ts` into `extra` and validated the way `apiBase` is: absent in a preview or
production build fails the build, absent in development disables the purchase surface. The
secret `sk_` key is the server's and appears nowhere here.

## Risks / Trade-offs

**Android IAP cannot be tested through the current release pipeline.** → `eas.json` builds
Android previews as an APK delivered by Firebase App Distribution, and Google Play Billing
only works for an app installed from Play. Testing needs an internal testing track in Play
Console, which is a change to `docs/releasing.md` and not a detail. iOS is fine: TestFlight
sandbox purchases work.

**The iOS provisioning profile is invalidated by the capability.** → Adding In-App Purchase to
the App ID needs an interactive `eas credentials -p ios` before the next build; CI cannot do
it (`AGENTS.md`). A manual step, once, ahead of the first build.

**The store can take money the server never hears about.** → That is exactly what the sync
route and the reconciler are for, and the screen says so rather than spinning. The worst case
is a subscriber who is Pro within the hour and sees an honest message meanwhile.

**A purchase made while signed out has nowhere to go.** → It is not offered: the button sends
a signed-out visitor to `/auth`. The store's own restore flow still works afterwards, because
restore runs against whichever account is identified at the time.

**`getOfferings` is a network call on a screen open.** → It is cached by the SDK and the
screen renders its plan state from `/me/plan` regardless, so a failed offerings fetch costs
the purchase button and not the screen.

## Migration Plan

1. Add the dependency and the two public keys; the surface stays hidden until they resolve.
2. Create the products in App Store Connect and Play Console, map them in RevenueCat to the
   `pro` entitlement and one offering.
3. `eas credentials -p ios` for the In-App Purchase capability, then a development build.
4. Sandbox purchase on iOS end to end: purchase, plan appears, restore, cancel.
5. Android through an internal testing track once `docs/releasing.md` is updated.

**Rollback.** The surface is behind the keys: removing them from the EAS environment hides
the paywall in the next build without touching code. Purchases already made keep conferring
Pro, because the server owns that.

## Resolved since drafting

- **The allowances ARE shown.** Settled the other way from the first draft: the plan screen
  lists each metered feature's standing today. The objection stands and is answered in the UI
  rather than by omission — none of these features is reachable from this app, so the section
  says so in a line above the list. The plan is one plan across the web and the app, and
  somebody deciding whether Pro is worth it should see what it lifts.

- **The entitlement is `pro`**, matching the server's `REVENUECAT_ENTITLEMENT` default. It is
  a string contract between the dashboard and the backend; nothing in this repository reads
  it, and nothing here would catch it being wrong.

- **Monthly and annual, both.** Prices are set in App Store Connect and Play Console and are
  read back through the offering, so no number lives in this repository — the screen prints
  the store's own formatted string for the buyer's storefront, and the annual saving is
  computed from the two prices whatever they turn out to be.

## Open Questions

- **Which store product identifiers back the offering?** This change binds to an offering
  rather than to product ids, so the code does not name them — but the packages the screen
  renders are whatever the dashboard publishes, and a mismatch shows up as an empty price
  list on a real device rather than as a failure in either repository.
