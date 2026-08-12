# Mobile Profile screen (simplified)

## Context

The mobile app currently has a single `account` modal (`src/app/account.tsx`):
identity (email, role/beta badges, joined date), a push-notification switch +
"Send test notification" button, and Sign out. The web app's equivalent is a
full `/my/profile` page (specializations, skills, location, CV upload, ATS
review, experience bank, tabs) — far more than mobile needs right now.

Mobile already reads the signed-in user's saved profile (`GET
/api/v1/me/profile`) via `useProfile()` (added for the Filters screen's
"Apply profile" button), but has no save/edit API wired up.

## Goal

Turn the Account screen into a Profile screen that additionally shows the
user's saved profile (specializations, skills, location) read-only, and drop
the push toggle / test-notification button from it.

## Design

**Screen**: `src/app/account.tsx` → renamed `src/app/profile.tsx`, route
`/profile`. Update the `Stack.Screen` entry in `src/app/_layout.tsx` and the
`router.push(user ? '/account' : '/auth')` call in `src/app/index.tsx`
accordingly. Stays a modal.

**Sections, top to bottom:**

1. **Identity** (unchanged) — avatar icon, email, role/beta badges, "Joined
   <date>".
2. **Profile** (new, only rendered when `user` is set) — sourced from the
   existing `useProfile()` hook, no new API calls:
   - **Specializations** — chips, labelled via `facetValueLabel('category',
     v)` (same helper `filters.tsx` uses for the category facet).
   - **Skills** — chips, raw skill tokens (same rendering as the Skills chips
     in `filters.tsx`).
   - **Location** — a compact one/two-line summary built from
     `profile.location_preferences`, skipping empty parts:
     - work modes: `facetValueLabel('work_mode', v)`, joined with ", "
     - remote reach: "Remote: <regions/countries>" (regions via
       `facetValueLabel('regions', v)`, countries uppercased)
     - base: "Based in: <country>, <city>" (whichever parts are present)
     - relocation: "Open to relocation: <regions/countries>" only when
       `relocation.open` is true
   - **Empty state** (`profile === null`): "No profile saved yet" plus a note
     that it can be set up on freehire.dev/my/profile — mobile stays
     read-only for now.
   - **Loading state**: spinner while `useProfile()` is pending, matching the
     existing loading treatment already used for push devices.
3. **Sign out** (unchanged).

**Removed**: the push `Switch`, "Send test notification" `Pressable`, their
handlers (`onTogglePush`, `onTestPush`), the `testResult` state, and the
`usePushNotifications()` call/import in this screen. `usePushNotifications`
itself and the push API functions (`registerPushToken`, `listPushDevices`,
`unregisterPushToken`, `sendTestPush`) in `api.ts`/`push.ts` are left in
place, unused — no in-app entry point to enable push remains for now, but
the code isn't deleted so a future push-settings surface can reuse it.

**Out of scope**: editing/saving the profile (no `PUT`/`DELETE`
`/api/v1/me/profile` wiring), CV upload, ATS review, experience bank, tabs —
all web-only for now.

## Testing

No new API surface, so nothing to unit-test beyond the existing coverage.
Manually verify in the iOS simulator: signed-in user with a saved profile
sees specializations/skills/location chips; a signed-in user with no saved
profile sees the empty-state copy; push toggle/test button are gone; Sign
out still works; `npm run lint` and `npx tsc --noEmit` pass.
