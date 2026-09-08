# Releasing

There are two different things people call "a release", and they are not the
same button:

| | Who gets it | Wired up? |
|---|---|---|
| **Testers** — TestFlight + Firebase App Distribution | People you invited | **Yes**, tag and go |
| **The public** — App Store + Google Play | Anyone | **Not yet**, see [Shipping to the stores](#shipping-to-the-stores) |

Google Play is the one in between: the pipeline for it exists and is switched
off, waiting on work that happens in the Play Console rather than here.

Tagging ships to testers. It does **not** put the app in front of the public.

## Releasing to testers

```bash
git tag v1.0.1
git push origin v1.0.1
```

That is the whole procedure. `.github/workflows/release.yml` fires on any `v*`
tag and runs these in parallel:

- **iOS** on the `production` profile, then `eas submit` to App Store Connect,
  where it appears under TestFlight.
- **Android** on the `preview` profile, then upload to Firebase App
  Distribution for the `testers` group.
- **Android again** on the `production` profile, then `eas submit` to Google
  Play — only when the repository variable `PLAY_SUBMIT_ENABLED` is `"true"`,
  which it is not yet. Two Android builds rather than one because the two
  destinations cannot share an artifact: Firebase takes an APK, Play takes an
  .aab.

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

**The repository side is done.** `eas.json` has a `submit.production.android`
block pointing at the `internal` track, `eas-build.yml` has a `submit-android`
input and the step that uses it, and `release.yml` has an `Android → Google
Play` job. That job is **off** until the repository variable
`PLAY_SUBMIT_ENABLED` is set to `true` (Settings → Secrets and variables →
Actions → Variables) — turning it on is the last step of the work below, not a
code change.

Nothing else is connected. As of the last check: the package
`me.freehire.mobile` is not on Play (404), the `androidpublisher` API is not
enabled on the `freehire-mobile` GCP project, and the only service accounts
there are the two Firebase ones. EAS holds no Google Play service account.

There is a wizard for the rest of it:

```sh
./scripts/setup-google-play.sh
```

It walks the ten steps below one screen at a time, opens each console page,
captures what you copy back, sets the EAS environment values and the repository
variable, and can be stopped with Ctrl-C and re-run. What follows is the same
procedure in prose, for reading rather than doing.

What remains, in the order it has to happen:

1. **Check the developer account type first**, because one answer costs two
   weeks. Play Console → Settings → Developer account → Account details. A
   **personal** account registered after 13 November 2023 cannot reach
   production until **20 testers have been in a closed test for 14 consecutive
   days**. An organisation account has no such requirement. If the rule
   applies, start the closed test before anything else here — everything else
   can be done while the clock runs.
2. **Create the app** in the Play Console with the package `me.freehire.mobile`
   and upload one `.aab` **by hand**. Google refuses the first upload of a
   package name over the API, so no amount of CI will do this one.
3. **Create a Google Cloud service account**, grant it release permissions in
   the Play Console, and give the JSON to EAS with `eas credentials -p android`.
   Storing it on EAS rather than as a repo secret is deliberate and matches how
   the Android keystore and the App Store Connect key are already held: nothing
   secret lives in this repository, so `EXPO_TOKEN` stays the only secret CI
   needs.
4. **Fill in** the store listing, content rating questionnaire, Data safety
   form, target audience and ads declarations. The Data safety answers are the
   same facts as Apple's App Privacy — derive them from
   [app-store-privacy.md](app-store-privacy.md) rather than answering twice from
   memory, and they must agree with the privacy manifest in `app.config.ts`.
   Play's account-deletion requirement is already met by the in-app delete
   screen.
5. **Set `PLAY_SUBMIT_ENABLED=true`.** From then on a `v*` tag builds the .aab
   and submits it to the `internal` track.

#### The track is in eas.json, not in a dropdown

`submit.production.android.track` is `internal`. That is the safe default and
the one to start on: internal testing reaches up to 100 testers immediately,
with no review.

It is **not** the track that satisfies the 20-testers rule. That needs *closed*
testing (`alpha`). Changing track is an edit to `eas.json`, reviewed like any
other change — deliberately not a workflow input, because a dropdown that can
push to `production` is a dropdown that eventually will.

#### Subscriptions have to be built again

The two products do not carry over from App Store Connect. Play needs its own
subscriptions with their own base plans, and RevenueCat needs its own Google
Play service account — a **different** credential from the one in step 3, even
if it belongs to the same account — before it can validate a purchase or
receive a webhook.

Check that `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`) exists in the EAS
`preview` and `production` environments. Its absence does not fail a build:
`revenueCatKeys.js` allows it on purpose and only warns on the build log, so a
release that silently cannot sell is a plausible outcome of forgetting it.

## Version numbers

`version` in `app.config.ts` is the user-visible one (`1.0.0`) — bump it by hand
when you want the number to change, and tag to match.

Build numbers are not yours to manage: `eas.json` sets `appVersionSource:
"remote"`, so EAS tracks them, and the `production` profile carries
`autoIncrement`. Two builds of the same `version` differ by build number, which
is what App Store Connect and Firebase key on.

That is why `app.config.ts` carries **no** `android.versionCode`. It used to
carry a literal `1`, which every EAS build ignored and only warned about. Play
refuses an upload whose version code it has already seen, so the literal was a
value that could only ever be wrong — from the second upload onward.

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
