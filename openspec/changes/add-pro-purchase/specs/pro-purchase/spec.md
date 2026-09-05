## ADDED Requirements

### Requirement: The plan the app shows comes from the server

The app SHALL decide whether a user is on Pro from `GET /api/v1/me/plan` alone, and SHALL NOT
gate any surface on the purchases SDK's `CustomerInfo`.

`CustomerInfo` drives the purchase flow — what is on sale, whether a purchase completed,
whether it was cancelled — and decides nothing about entitlement. The web and the app share
one plan and only the server sees both; the API answers 402 from the server's view; and a
refund the store processed an hour ago is in the server's column whether or not it is in a
cached `CustomerInfo`.

#### Scenario: The server decides, not the device

- **WHEN** the SDK reports an active entitlement and `/me/plan` reports the free plan
- **THEN** the app shows the free plan

#### Scenario: A plan the app never sold is still shown

- **WHEN** the signed-in user's plan came from the web and the device holds no store purchase
- **THEN** the app shows Pro

#### Scenario: The plan is not read for a signed-out visitor

- **WHEN** nobody is signed in
- **THEN** the app makes no request for a plan and shows no plan state

### Requirement: A signed-in user can buy Pro in the app

The app SHALL present the packages of the configured RevenueCat offering and SHALL complete a
purchase through the store.

#### Scenario: The packages come from the provider

- **WHEN** the paywall opens and the offering resolves
- **THEN** each package is shown with the price string the store returned for the user's
  region, and none is shown with a price composed in the app

#### Scenario: A purchase requires an account

- **WHEN** a signed-out visitor taps the purchase button
- **THEN** the app opens the sign-in sheet and starts no purchase

#### Scenario: Offerings that will not load do not break the screen

- **WHEN** the offering cannot be fetched
- **THEN** the plan state is still shown, the purchase button reports itself unavailable, and
  the screen offers a retry

### Requirement: A completed purchase is confirmed against the server

On a successful purchase the app SHALL call `POST /api/v1/billing/revenuecat/sync` and refetch
the plan, rather than waiting for the provider's webhook.

The webhook arrives after the purchase completes on the device, its last retry is 80 minutes
later, and the reconciler runs hourly. Without the round trip a paid subscriber can sit in
front of a paywall.

#### Scenario: Pro appears without waiting for a webhook

- **WHEN** a purchase completes
- **THEN** the app calls the sync route, refetches the plan, and shows Pro

#### Scenario: A server that has not caught up says so

- **WHEN** the purchase completed but the plan still reports free after the bounded retries
- **THEN** the app states that the payment was taken and access is on its way, and does not
  present the purchase again

#### Scenario: A cancelled purchase is not an error

- **WHEN** the user dismisses the store's purchase sheet
- **THEN** the app returns to the paywall with no error shown

#### Scenario: A failed purchase leaves the plan untouched

- **WHEN** the store reports a failure
- **THEN** the plan shown is whatever the server last reported, and the error names what went
  wrong

### Requirement: Purchases are identified with the signed-in account

The app SHALL identify the purchases SDK with the signed-in user's own `users.id`, and SHALL
clear that identity when the session ends, in the same transition that clears private cached
data.

The failure this prevents is two accounts on one device: an identity set when a screen opens
rather than when the session changes leaves the previous `app_user_id` in place until that
screen is next visited, and a purchase in between is attached to the wrong account at the
provider, permanently.

#### Scenario: Signing in identifies the buyer

- **WHEN** a user signs in
- **THEN** the SDK is identified with that user's id

#### Scenario: Signing out clears the identity

- **WHEN** the session ends for any reason
- **THEN** the SDK identity is cleared

#### Scenario: A second account on one device does not inherit the first

- **WHEN** one user signs out and another signs in on the same device
- **THEN** a purchase made afterwards is attributed to the second user

### Requirement: The purchase surface answers to where the plan came from

The app SHALL read `pro_source` from the plan and SHALL NOT offer an in-app purchase to a user
whose plan came from another origin.

This is a store rules requirement. Selling Pro to somebody already paying through Stripe
charges them twice for one plan, and Apple forbids directing an in-app subscriber to a web
page to cancel — so the app must know which kind of subscriber it is looking at before it
says anything about cancelling.

#### Scenario: A store subscriber is pointed at the store

- **WHEN** `pro_source` is `revenuecat`
- **THEN** the screen shows the plan and a link to the store's own subscription management,
  and offers no purchase

#### Scenario: A web subscriber is not sold the same plan twice

- **WHEN** `pro_source` is `stripe`
- **THEN** the screen shows the plan and where it is managed, and offers no in-app purchase

#### Scenario: A granted plan offers nothing to manage

- **WHEN** `pro_source` is `granted`
- **THEN** the screen shows the plan and its expiry, with nothing to buy or cancel

#### Scenario: A free account is offered the purchase

- **WHEN** the plan is free
- **THEN** the packages and the purchase button are shown

### Requirement: The plan surface states what the plan allows each day

The app SHALL list each metered feature's standing today from the plan's allowances, and SHALL
say that those features are used elsewhere.

The plan is one plan across the web and the app, and somebody deciding whether Pro is worth it
should see what it lifts. None of the metered features is reachable from this app, which is why
the list is captioned rather than presented bare — an uncaptioned list reads as a promise about
buttons that are not here.

#### Scenario: A limited feature reads as a count against its ceiling

- **WHEN** a feature has an enforced daily limit
- **THEN** the row shows what has been used of it today

#### Scenario: An unenforced ceiling is not presented as a limit

- **WHEN** the server reports the ceiling as counted but not enforced
- **THEN** the row states what has been used and does not name a ceiling, because nothing is
  refused at it

#### Scenario: A feature this build has no label for is still shown

- **WHEN** the plan carries a feature the app does not recognise
- **THEN** it is listed under its own name rather than hidden, so a feature added on the server
  appears without a release

#### Scenario: A plan carrying no allowances lists none

- **WHEN** the plan carries no allowances
- **THEN** the section is absent and the rest of the screen is unchanged

### Requirement: A user can restore purchases they already own

The app SHALL offer to restore purchases, and SHALL confirm the result against the server the
same way a new purchase is confirmed.

Apple requires this of any app selling a non-consumable or a subscription. It is also the
recovery path for a reinstall, a new device, or a purchase whose webhook was lost.

#### Scenario: A restored subscription confers Pro

- **WHEN** a user with an active store subscription restores purchases
- **THEN** the app calls the sync route, refetches the plan, and shows Pro

#### Scenario: Nothing to restore is stated plainly

- **WHEN** the restore finds no purchase for this account
- **THEN** the app says so and leaves the plan as the server reports it

### Requirement: The purchase surface is absent when it cannot work

The app SHALL hide the purchase surface when the provider keys are not configured, and SHALL
NOT fail to build, launch or navigate because of their absence.

#### Scenario: A build without keys still runs

- **WHEN** the app runs in development with no provider keys
- **THEN** the plan is still shown and the purchase surface is absent

#### Scenario: A release build demands its keys

- **WHEN** a preview or production build is configured without the provider keys
- **THEN** the build fails before it starts, in the same way a missing API origin does

#### Scenario: The rest of the app is unaffected where the SDK cannot run

- **WHEN** the app runs where the native module is unavailable
- **THEN** every other screen behaves as before and only the purchase surface is absent
