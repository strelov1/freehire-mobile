# App Privacy — what to answer, and why

Apple asks the same question in two places, and they must agree:

1. **App Privacy** in App Store Connect — the questionnaire behind the "App
   Privacy" section of a listing.
2. **`PrivacyInfo.xcprivacy`** — the privacy manifest compiled into the binary.

This document answers both from what the code actually sends, so the two cannot
be filled in from different assumptions.

## The manifest currently contradicts the app

`ios/freehiremobile/PrivacyInfo.xcprivacy` declares:

```xml
<key>NSPrivacyCollectedDataTypes</key>
<array/>
```

An empty array says "this app collects nothing". It does. Apple cross-checks the
manifest against the questionnaire, and a mismatch is grounds for rejection.

The file itself is not the place to fix it: `ios/` is gitignored and regenerated
by prebuild, so an edit there survives until the next build and no longer. The
declaration belongs in `app.config.ts` under `ios.privacyManifests`, which Expo
writes into the generated manifest.

## What the app actually collects

Read off `src/lib/api.ts` and the auth feature — every call that leaves the
device.

| Data | Where it comes from | Linked to the user? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Email address | Sign-up, sign-in, OAuth (Google, GitHub, LinkedIn, Apple) | Yes | No | App Functionality, Account Management |
| Name | Only if an OAuth provider supplies it | Yes | No | App Functionality |
| Specializations, skills, avoided skills, location preferences | The profile the user fills in | Yes | No | App Functionality — this is what the match is computed from |
| Saved, hidden and tracked jobs, application stages and notes | Saving, hiding, tracking a role | Yes | No | App Functionality |
| Purchase history | RevenueCat, for the Pro subscription | Yes | No | App Functionality |
| Device ID (push token) | `registerPushToken`, only after the user allows notifications | Yes | No | App Functionality |
| Product interaction (a job viewed) | The server counts views of a posting | Yes | No | App Functionality — the public view count on a card |

**Nothing is used for tracking** in Apple's sense: no data leaves for an ad
network or a data broker, nothing is joined with third-party data, and there is
no ATT prompt because there is nothing to ask about. `NSPrivacyTracking` stays
`false`.

**No third-party analytics SDK is present.** There is no Sentry, no Amplitude,
no PostHog, no Firebase Analytics in the app — Firebase appears only as the
distribution channel for tester builds, which is not part of the shipped binary.

## What to answer in App Store Connect

For each of the rows above: **Yes, collected** → **Linked to the user** → **Not
used for tracking** → purpose **App Functionality** (add *Account Management*
for the email).

Everything else in the questionnaire — location, contacts, health, financial
info, browsing history, search history, sensitive info, diagnostics — is **not
collected**. Two that look like traps:

- **Search history**: the app sends the query text to search jobs, but nothing
  stores a per-user search history. Answer no.
- **Location**: the profile has *location preferences* the user typed. That is
  not device location, and the app requests no location permission. Answer no.

## The manifest patch

Add to `app.config.ts`, inside `ios`:

```ts
privacyManifests: {
  NSPrivacyTracking: false,
  NSPrivacyCollectedDataTypes: [
    {
      NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
      NSPrivacyCollectedDataTypeLinked: true,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: [
        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
      ],
    },
    {
      NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent',
      NSPrivacyCollectedDataTypeLinked: true,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: [
        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
      ],
    },
    {
      NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePurchaseHistory',
      NSPrivacyCollectedDataTypeLinked: true,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: [
        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
      ],
    },
    {
      NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
      NSPrivacyCollectedDataTypeLinked: true,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: [
        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
      ],
    },
    {
      NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
      NSPrivacyCollectedDataTypeLinked: true,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: [
        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
      ],
    },
  ],
},
```

The profile — skills, specializations, saved and tracked jobs — has no dedicated
Apple type; `OtherUserContent` is the category Apple points at for content a
user creates in the app.

The API-access reasons already in the generated manifest (file timestamp, user
defaults, boot time) come from Expo's own modules and stay as they are.

**This changes the binary**, so it needs a new build and therefore a new tag.
Do it in the same pass as the RevenueCat keys rather than as a separate release.
