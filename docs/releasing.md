# Releasing

There are two different things people call "a release", and they are not the
same button:

| | Who gets it | Wired up? |
|---|---|---|
| **Testers** — TestFlight + Firebase App Distribution | People you invited | **Yes**, tag and go |
| **The public** — App Store + Google Play | Anyone | **No**, see [Shipping to the stores](#shipping-to-the-stores) |

Tagging ships to testers. It does **not** put the app in front of the public.

## Releasing to testers

```bash
git tag v1.0.1
git push origin v1.0.1
```

That is the whole procedure. `.github/workflows/release.yml` fires on any `v*`
tag and runs two builds in parallel:

- **iOS** on the `production` profile, then `eas submit` to App Store Connect,
  where it appears under TestFlight.
- **Android** on the `preview` profile, then upload to Firebase App
  Distribution for the `testers` group.

Builds run on EAS, not on the GitHub runner — the workflow only invokes
`eas build` and waits. Expect ~15–25 minutes.

### Why the two platforms use different profiles

Not an oversight, and don't "fix" it:

- **iOS must be `production`.** TestFlight *is* App Store Connect, so the
  binary has to be an App Store build.
- **Android must be `preview`.** `production` emits an `.aab` for Google Play,
  and Firebase App Distribution rejects it (`APK cannot be analyzed using aapt
  dump badging`) unless the app is linked to a Play account. The APK comes from
  the internal-distribution profiles.

Picking `production` + Firebase by hand now fails in the first seconds with a
message naming the profile, rather than after a full build with a message about
`aapt`.

### In-app purchases do not work on this path — Android

**Google Play Billing only works for an app installed from Play.** A tester
holding the Firebase APK can open the plan screen, see the plan the server
reports, and get nothing at all where the prices should be: `getOfferings`
returns an empty offering, because the billing library has no Play install to
talk to. Nothing is broken and nothing says so — which is why it is written down
here rather than discovered.

So testing an Android purchase means an **internal testing track** in Play
Console, with the `production` profile's `.aab` uploaded to it and testers
invited there. That is a second delivery route alongside Firebase, not a
replacement: Firebase stays the fast path for everything that is not a purchase.

**iOS has no equivalent problem.** TestFlight builds transact against Apple's
sandbox, so a purchase can be made, cancelled and restored end to end on the
`production` profile this pipeline already ships.

### In-app purchases need a capability — iOS

Adding **In-App Purchase** to the App ID invalidates the provisioning profile,
so `eas credentials -p ios` has to be run interactively once before the next
build. CI cannot do it. This is the same hazard the entitlement note at the
bottom of this document describes, and it applies here for the same reason.

The two public RevenueCat keys must also exist in the EAS environment before a
preview or production build — `app.config.ts` fails the build without them, in
the first seconds, naming the variable:

```bash
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_… --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_… --environment preview --visibility plaintext
```

Repeat for `production`. These are RevenueCat's **public** platform keys, which
are meant to ship inside the binary. The secret `sk_` key belongs to the server
and must never appear in an `EXPO_PUBLIC_*` value.

### Who actually receives it

**iOS** goes to the internal group **`Freehire Test Team`** — [App Store
Connect](https://appstoreconnect.apple.com/apps/6801885119/testflight/ios) →
TestFlight. `release.yml` names it, so tagged builds are assigned automatically.

There are two kinds of TestFlight group and the difference is not cosmetic:

- **Internal** — no Apple review, ever. Builds reach testers 5–10 minutes after
  submission, as soon as Apple finishes processing. Up to 100 people. The price
  is that each one must be a user in *your* App Store Connect (Users and Access)
  holding one of: Account Holder, Admin, App Manager, Developer, or Marketing.
  Marketing is the least privileged of those, so it is the right role for
  someone who is only meant to test.
- **External** (`Beta`) — any email address, no account of yours involved. The
  price is Beta App Review on the first build of *each version*: roughly a day,
  plus "What to Test" notes and, since the app has a sign-in, a demo account for
  the reviewer. Once a version is approved, later builds of that same version go
  out immediately, and the group's public link starts working.

Only the internal group is automated. `eas submit --groups` documents itself as
taking internal groups, and naming the external one would buy nothing: its
testers cannot install until that build clears review, which is submitted by
hand in App Store Connect anyway. Attach the build to `Beta` during the same
visit.

**Android** goes to the Firebase group **`testers`**, which already exists and
has its members. No App Store Connect seat, no review, no ceremony — any email
works.

## Shipping to the stores

Neither store is wired up. This is what each one still needs.

### App Store

The pieces that exist: the app record (ASC App ID `6801885119`), the signing
credentials, and an App Store Connect API key on EAS (`6GKQH54MG5`, role Admin),
so uploads already work — that is what TestFlight uses.

What is missing is everything Apple asks for before a build can go public:
listing metadata, screenshots for every required device size, the privacy
questionnaire ("App Privacy"), age rating, support and marketing URLs, and a
demo account if any part of the app is behind sign-in.

Then, in App Store Connect, you attach a processed build to a version and submit
it for App Review. `eas submit` uploads binaries; it does not submit for review.
Review takes anywhere from a day to a week on a first submission.

### Google Play

Nothing is connected: EAS holds **no** Google Play service account, and
`eas.json` has no `submit.android` block.

To wire it:

1. Create the app in the Play Console and upload one `.aab` **by hand** — Google
   requires the first upload of a package name to be manual.
2. Create a Google Cloud service account, grant it release permissions in the
   Play Console, and give the JSON to EAS
   (`eas credentials -p android`, or `submit.production.android.serviceAccountKeyPath`).
3. Fill in the store listing, content rating, data safety form and target
   audience declarations.

After that, `eas submit -p android --profile production` can push to a track.
Build the `.aab` with the `production` profile, not `preview`.

## Version numbers

`version` in `app.config.ts` is the user-visible one (`1.0.0`) — bump it by hand
when you want the number to change, and tag to match.

Build numbers are not yours to manage: `eas.json` sets `appVersionSource:
"remote"`, so EAS tracks them, and the `production` profile carries
`autoIncrement`. Two builds of the same `version` differ by build number, which
is what App Store Connect and Firebase key on.

## Building without releasing

`.github/workflows/eas-build.yml` still runs manually — Actions → EAS Build →
Run workflow, or:

```bash
gh workflow run eas-build.yml --ref master -f platform=all -f profile=preview
```

With both distribution toggles off (the default) it dispatches the build and
returns immediately; the artifacts wait on EAS. Turn one on and the job blocks
until the build finishes, because it needs the artifact.

`release.yml` calls this same workflow once per platform, so a change to the
build or distribution steps only has to be made in one place.

## Traps that have already cost a day

- **`eas submit` needs `ascAppId` spelled out to run non-interactively.**
  Without it the submission dies two seconds in with `Set ascAppId in the
  submit profile (eas.json) or re-run this command in interactive mode` —
  after a full ~7 minute build, since the submit step is what consumes it.
  Interactively EAS just asks; CI has nobody to ask. It now sits in
  `submit.production.ios` alongside `appleTeamId`. A build that got this far
  is fine — `eas submit -p ios --profile production --id <build-id>` ships the
  existing artifact without rebuilding.

- **A new entitlement or capability in `app.config.ts` invalidates the iOS
  provisioning profile.** The build fails deep inside fastlane, complaining
  that the profile lacks the capability. Regenerate it *before* the next build:
  `eas credentials -p ios` → build profile `production` → delete the
  provisioning profile → `All: Set up all the required credentials`. It needs an
  interactive Apple login with 2FA, so CI can never do it for you. Tell the App
  Store profile from the Ad Hoc one by its lack of a "Provisioned devices" list.

- **Every EAS environment needs `EXPO_PUBLIC_API_BASE`.** `apiBase.js` throws
  rather than guessing for anything but `development`, so a missing value fails
  the build in ~25 seconds at "Read app config". `production` and `preview` are
  set to `https://freehire.me`; a new environment needs its own.

- **Don't rename `slug`, `scheme`, `bundleIdentifier` or `package`.** EAS, the
  signing profile, the App Store Connect record, Firebase, and freehire.me's
  `apple-app-site-association` all hold those. Renaming one produces a different
  app, not a renamed one. The name under the icon is `name`, and only `name`.
