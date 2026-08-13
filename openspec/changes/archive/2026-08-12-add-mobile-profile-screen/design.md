## Context

`src/app/account.tsx` is a modal screen reachable when a signed-in user taps
the account icon (`src/app/index.tsx`). It currently renders identity
(avatar, email, role/beta badges, joined date), a push-notification `Switch`
+ "Send test notification" button (via `usePushNotifications()`), and a Sign
out button. It is registered as the `account` route in `src/app/_layout.tsx`.

The signed-in user's saved profile (specializations, skills,
`location_preferences`) is already available via `useProfile()`
(`src/lib/useProfile.ts`), added for the Filters screen's "Apply profile"
button. Label formatting for specialization/work-mode/region codes already
exists in `src/lib/format.ts` (`facetValueLabel`). Mobile has no
create/edit/delete-profile API wiring (`api.ts` only has `getProfile`).

## Goals / Non-Goals

**Goals:**
- Show the signed-in user's saved profile (specializations, skills,
  location) on the account screen, reusing existing data/formatting.
- Drop the push switch and test-notification button from this screen.
- Rename the screen/route from "account" to "profile" to match its new,
  broader purpose.

**Non-Goals:**
- No profile editing, creation, or deletion (no `PUT`/`DELETE
  /api/v1/me/profile` wiring).
- No CV upload, ATS review, experience bank, or tabs — those stay web-only.
- No new push-settings surface; `usePushNotifications` and its API functions
  are left in place, just unused, for a future change to pick up.

## Decisions

- **Rename `account.tsx` → `profile.tsx`, route `/account` → `/profile`**,
  rather than adding a second screen. The screen's job is broadening (from
  "manage your account" to "your account + your profile"), and the web app
  already calls the equivalent page "Profile" — one screen keeps navigation
  simple and avoids a second entry point to maintain. Every reference to the
  old route (`_layout.tsx`'s `Stack.Screen`, `index.tsx`'s
  `router.push('/account')`) is updated in the same change so there is no
  dangling route.
- **Read-only for now.** The web profile page is a full editable form; mobile
  has no save/edit API integration today. Building that is materially more
  work (new API calls, validation, skill/specialization pickers) and out of
  scope for this pass — the proposal explicitly limits this change to
  *viewing* the already-fetched profile.
- **Reuse `useProfile()` and `facetValueLabel()` as-is**, no new API
  surface. `useProfile()` already gates on `!!user` and is already used by
  `filters.tsx`, so the profile screen's loading/null states are consistent
  with the rest of the app instead of introducing a second data path.
- **Distinguish a failed fetch from "no profile saved".** `useProfile()`'s
  `isError` was initially left unhandled, which would show "No profile saved
  yet" on a network failure — a false claim about the account's actual saved
  state. The screen now renders a distinct error message when `isError` is
  true, checked before the `profile === null` empty-state branch.
- **Location rendered as a short derived summary, not a form.** The web
  page's location UI is a full preferences editor; the mobile screen instead
  computes 2-4 short lines (work modes / remote reach / base / relocation)
  directly from `profile.location_preferences`, skipping empty parts. This
  keeps the read-only screen compact instead of mirroring the web layout.
- **Push UI removed, push code left in place.** `usePushNotifications`,
  `registerPushToken`/`listPushDevices`/`unregisterPushToken`/`sendTestPush`
  stay in `api.ts`/`push.ts` unused rather than deleted, so a future
  push-settings surface (this screen or elsewhere) can reuse them without
  re-deriving the logic. Confirmed with the user as the preferred trade-off
  over deleting now and re-adding later.

## Risks / Trade-offs

- [Route rename breaks any hardcoded `/account` reference] → grepped the repo
  for `/account`; only `_layout.tsx` and `index.tsx` reference it, both
  updated in this change. No deep-link config or push-notification payload
  references the route.
- [Removing the push UI leaves signed-in users with no way to opt into push
  in-app] → accepted for this change; a follow-up change can reintroduce a
  push-settings entry point. Users who already registered a device keep
  receiving pushes (nothing unregisters them).
- [Dead code lingers in `usePushNotifications`/`push.ts` until reused] →
  acceptable short-term; flagged in the proposal/design so it isn't
  forgotten, not hidden.

## Migration Plan

Single-PR change, no data migration. Deploy is just a new app build; no
backend changes, so no rollout sequencing is needed. Rollback is reverting
the commit (or the route rename alone, if only that were problematic — but
it is expected to ship as one unit).

## Open Questions

None outstanding — scope, read-only-ness, and push-code disposition were
confirmed with the user before writing this design.
