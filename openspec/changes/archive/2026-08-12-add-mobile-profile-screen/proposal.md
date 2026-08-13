## Why

The mobile app's only account surface (`src/app/account.tsx`) shows identity
and a push-notification switch, but nothing about the user's saved profile
(specializations, skills, location) — even though that profile is already
fetched elsewhere in the app (`useProfile()`, used by the Filters screen's
"Apply profile" button). Users have no way to see what profile data is on
file for them without leaving the app. The push switch and test-notification
button also add surface area to this screen without a clear owner right now.

## What Changes

- Rename `src/app/account.tsx` → `src/app/profile.tsx` (route `/account` →
  `/profile`), updating the `Stack.Screen` entry in `src/app/_layout.tsx` and
  the `router.push('/account')` call in `src/app/index.tsx`. **BREAKING**
  (route rename; no external deep links reference `/account` today).
- Add a read-only "Profile" section to the screen, sourced from the existing
  `useProfile()` hook (no new API calls): specializations and skills as
  chips, and a compact location-preferences summary (work modes, remote
  reach, base, relocation).
- Add an empty-state message when the signed-in user has no saved profile
  yet, pointing to the web app to set one up (mobile has no
  create/edit/delete profile UI in this change), and a distinct error-state
  message when the profile fetch itself fails.
- Remove the push-notification `Switch`, "Send test notification" button,
  and their handlers from this screen. `usePushNotifications` and the push
  API functions in `api.ts`/`push.ts` are left in place but become unused by
  any screen.

## Capabilities

### New Capabilities
- `mobile-profile-view`: read-only display of the signed-in user's saved
  profile (specializations, skills, location preferences) on the mobile
  account/profile screen, including the no-profile-saved empty state.

### Modified Capabilities
(none — no existing `openspec/specs/` capabilities cover the account screen
or push notifications yet)

## Impact

- `src/app/account.tsx` → `src/app/profile.tsx` (renamed, content changed)
- `src/app/_layout.tsx` (route registration)
- `src/app/index.tsx` (navigation target)
- `src/lib/format.ts` (existing facet-label helpers reused; new
  `profileLocationSummary` formatter added, covered by new
  `src/lib/format.test.ts`)
- No API/backend changes — reuses `GET /api/v1/me/profile` via the existing
  `useProfile()` hook.
