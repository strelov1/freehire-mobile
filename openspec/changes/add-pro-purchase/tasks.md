## 1. Configuration and the SDK boundary

- [x] 1.1 Add `react-native-purchases` and resolve the two public platform keys in
      `app.config.ts` into `extra`, validated the way `apiBase` is: a preview or production
      build without them fails, development without them disables the surface. Extend
      `app.config.test.ts` to cover both directions.
- [x] 1.2 `src/features/billing/purchases.ts` — the only file in the project that imports
      `react-native-purchases`, on the shape of `src/lib/notifications.ts`: a `getPurchases()`
      returning `null` where the module cannot work, plus the resolved platform key.
- [x] 1.3 `src/features/billing/model/offering.ts` — a pure `Offering → PurchaseOption[]`:
      order, the store's own price string, the annual saving. Tests with no native module.

## 2. The plan, from the server

- [x] 2.1 `src/features/billing/api/planApi.ts` — `getPlan()` and `syncStorePurchase()` over
      the existing `request()` with `authMode: 'required'`. Types for `pro_source`.
- [x] 2.2 `src/lib/usePlan.ts` — react-query, `enabled: !!user`, keyed under `privateKeys` so
      `clearPrivateUserData` drops it on an identity change. Add the key to
      `src/lib/queryKeys.ts` beside the others.
- [x] 2.3 `src/features/billing/model/planView.ts` — a pure mapping from the plan response to
      what the screen offers, one case per `pro_source` plus free, unavailable and loading.
      This is where the store rules live, so it is the piece with the most tests.

## 3. Identity

- [x] 3.1 Call `Purchases.logIn(String(user.id))` and `logOut()` from the session transition
      in `src/lib/authStore.tsx` that already calls `clearPrivateUserData`. Not from a screen.
- [x] 3.2 Test the transition directly: signing in identifies, signing out clears, and a
      second account on the same device does not inherit the first's identity.

## 4. The screen

- [x] 4.1 `src/app/account/plan.tsx` — plan state, packages, purchase, restore, a link to the
      store's own subscription management, and the terms and privacy links Apple expects on a
      paywall. Built on `getColors`/`tokens.generated`, no second design system.
- [x] 4.2 Purchase flow: buy, then `POST /billing/revenuecat/sync`, then refetch with a
      bounded backoff; a user cancellation is silent; a taken payment the server has not seen
      yet says so plainly instead of offering the purchase again.
- [x] 4.3 Restore purchases, confirmed the same way, with "nothing to restore" stated plainly.
- [x] 4.4 Move the store subscription URLs out of `src/app/account/delete.tsx:25-26` into one
      place both screens use.
- [x] 4.5 Register `account/plan` in `src/app/_layout.tsx` and add the plan row to
      `src/app/(tabs)/profile.tsx`.

## 5. Guardrails

- [x] 5.1 `npm run lint`, `npx tsc --noEmit` and `npm test -- --runInBand` clean. The strict
      config includes `noUncheckedIndexedAccess`, which the offering mapping meets.
- [ ] 5.2 NEEDS A DEVICE — confirm the app still runs where the native module is absent, with
      the plan shown and only the purchase surface missing. The decision path is covered by
      `purchases.test.ts` and `planView.test.ts` (`canPurchase: false` renders the plan and
      offers nothing), but "the app launches on a build without the module" is only provable
      by launching it.

## 6. Release and store setup

- [x] 6.1 Update `docs/releasing.md`: Android IAP cannot be tested through the current
      pipeline, because previews ship as an APK through Firebase and Play Billing requires an
      install from Play. Name the internal testing track as the way in.
- [ ] 6.2 NEEDS STORE ACCESS — create the monthly and annual products in App Store Connect and
      Play Console, with the paid-apps agreement and banking details in place.
- [ ] 6.3 NEEDS DASHBOARD ACCESS — map those products to the `pro` entitlement and one
      offering in RevenueCat; the entitlement id must match the server's
      `REVENUECAT_ENTITLEMENT`.
- [ ] 6.4 NEEDS APPLE ACCOUNT ACCESS — add the In-App Purchase capability to the App ID and
      run `eas credentials -p ios`; it invalidates the provisioning profile and CI cannot do
      it.
- [ ] 6.5 NEEDS EAS ACCESS — `eas env:create` the two public keys in the preview and
      production environments.
- [ ] 6.6 NEEDS STORE ACCESS — sandbox purchase end to end on both platforms: purchase,
      restore, cancel, and a lapse.
