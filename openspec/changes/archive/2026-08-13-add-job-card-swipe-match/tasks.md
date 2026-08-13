## 1. Color tokens

- [x] 1.1 Add `destructive` and `destructiveMuted` to `FreehirePalette`
  (`src/constants/freehire.ts`): light `#dc2626`/a ~12-15% alpha tint, dark
  `#f87171`/its alpha tint. Replace the ad hoc `#dc2626` literals in
  `src/app/auth.tsx:192`, `src/app/profile.tsx:90`, and
  `src/app/filters.tsx:350` (`EXCLUDE_COLOR`) with `c.destructive` (note:
  `account.tsx` no longer exists — the mobile "Account" screen is now
  `profile.tsx` on current `master`; this replaces the earlier plan's stale
  file reference).

## 2. Skill match: pure computation (TDD, framework-free)

- [x] 2.1 Write failing tests in `src/lib/jobMatch.test.ts` for
  `computeClientMatch(jobSkills, profileSkills)`: partial overlap (case-
  insensitive), full overlap, zero overlap, empty job skills (no division by
  zero), empty profile skills.
- [x] 2.2 Implement `computeClientMatch` in `src/lib/jobMatch.ts` — port of
  `hire/web/src/lib/jobMatch.ts::computeClientMatch` — until tests pass.

## 3. Profile data layer — ALREADY MERGED, reuse as-is

- [x] 3.1 ~~Add a minimal `UserProfile` type~~ — `add-apply-profile-filters` has
  landed on `master` since this change was proposed. `src/lib/types.ts` already
  has `UserProfile` (with `skills: string[]`, plus `specializations`,
  `excluded_skills`, `location_preferences` — this change only reads `.skills`).
  No new type needed.
- [x] 3.2 ~~Add `getProfile()`~~ — already in `src/lib/api.ts`, hitting
  `GET /api/v1/me/profile`, same shape this change needs.
- [x] 3.3 ~~Add `useProfile()`~~ — already in `src/lib/useProfile.ts`
  (`queryKey: ['profile']`, `enabled: !!user`). Use it directly in task 5.1.

## 4. Dismiss (hide) data layer

- [x] 4.1 Add `dismissJob(slug)`, `undismissJob(slug)`, `dismissedSlugs()` to
  `src/lib/api.ts`, mirroring `saveJob`/`unsaveJob`/`savedSlugs`'s shape against
  `POST`/`DELETE /api/v1/jobs/:slug/dismiss` and
  `GET /api/v1/me/tracking/dismissed`.
- [x] 4.2 No dedicated hook test: confirmed `useSavedJobs`/`useProfile`/
  `useNotifications`/`usePushNotifications` — every existing React Query hook
  in this codebase — has zero unit test coverage (no `@testing-library/react-*`
  dependency exists to test one; only pure functions get `.test.ts` files, e.g.
  `push.test.ts` tests `push.ts`'s pure helpers, not its hooks). Adding a new
  test-hook dependency for one hook would break that convention. Verified
  instead via the simulator in task 8.2 (hide, and a failed-request rollback).
- [x] 4.3 Implement `src/lib/useDismissedJobs.ts` (queryKey `['dismissed']`,
  optimistic hide, rollback on error) — mirrors `useSavedJobs`'s shape.

## 5. JobCard: skill chip tinting + match bar

- [x] 5.1 In `JobCard`, compute `profileSkills` from `useProfile()` and derive
  the match via `computeClientMatch` only when the user is signed in and the
  profile has at least one skill; otherwise treat as "no match" (per
  `job-card-profile-match` spec).
- [x] 5.2 Recolor each skill chip: held tint (existing brand style) vs missing
  tint (new `destructive`/`destructiveMuted` tokens) based on the computed
  match; fall back to the current neutral tint when there's no real match.
- [x] 5.3 Add the match bar (two-tone track + "`N% · matched/total skills`"
  label) below the skill row, rendered only when a real match exists.

## 6. JobCard: swipe actions

- [x] 6.1 Remove `JobCard`'s `SaveButton` render; wrap the card body in
  `ReanimatedSwipeable` (`react-native-gesture-handler`) with
  `renderLeftActions` (save, brand-tinted bookmark icon — revealed by swiping
  the row left) and `renderRightActions` (hide, destructive-tinted eye-slash
  icon — revealed by swiping right). Also added `GestureHandlerRootView` to
  `src/app/_layout.tsx`, a prerequisite for any gesture-handler gesture to
  work, that the app didn't have yet. **Revised per direct feedback after the
  first pass**: (a) direction was backwards (shipped right=save/left=hide,
  corrected to left=save/right=hide) and (b) the action panel originally
  filled with a full solid color — changed to a neutral (`c.card`) panel
  background with only the icon tinted, per feedback that a full color fill
  was too heavy.
- [x] 6.2 Wire the left-reveal (swipe-left) action to `useSavedJobs().toggle`
  (existing hook, unchanged) and the right-reveal (swipe-right) action to
  `useDismissedJobs`'s hide mutation; both route signed-out users to `/auth`
  instead of acting, matching `SaveButton`'s existing signed-out behavior.
- [x] 6.3 Revised from the design doc's two-path plan (reveal-then-tap +
  separate far-swipe auto-commit): `Swipeable`'s release resolution is binary
  (opens fully or closes fully at a single threshold), so a genuinely distinct
  second "auto-commit" threshold would need bypassing `Swipeable` for a
  hand-rolled `PanGestureHandler` — exactly what the design doc ruled out.
  Implemented instead: `onSwipeableOpen` fires the action immediately once a
  swipe crosses `leftThreshold`/`rightThreshold` (single continuous swipe
  commits, matching the user's original ask literally) and the revealed
  action button's `onPress` calls the same handler (reachable via tap/
  VoiceOver even though in practice the swipe usually already committed).
  Satisfies the spec's "reachable either by dragging past the threshold or by
  tapping the action" without a bespoke gesture implementation.

## 7. Feed: exclude dismissed jobs

- [x] 7.1 In `src/app/index.tsx`, read `useDismissedJobs()`'s set and filter it
  out of the flattened `jobs` array before handing pages to `FlashList`.

## 8. Verify, simplify, review

- [x] 8.1 Run unit tests (`jobMatch.test.ts`); run `tsc --noEmit`; run
  `npm run lint`. All green (68/68 tests; `useDismissedJobs.test.ts` was
  deliberately not created — see task 4.2's note).
- [x] 8.2 Verified in the iOS simulator (built via `expo run:ios`, driven with
  `idb ui swipe`/`tap` + screenshots): the app boots and the feed renders with
  the new card layout (bookmark button gone, no crash); every chip renders in
  the existing neutral tint and no match bar shows for a signed-out viewer,
  matching the no-real-match spec scenarios; a left swipe and a right swipe on
  a card both drag the row and, on commit, correctly route to `/auth` (the
  signed-out gate) without acting, and the app remains stable afterward. NOT
  verified live (no test account credentials available in this session): the
  signed-in save/hide mutations actually persisting, the failed-dismiss
  rollback, chip/match-bar rendering against a real profile with partial
  overlap, and cross-session dismissed-job persistence. Those paths are
  covered by the code review (data-layer logic read side-by-side with
  `useSavedJobs`) and `jobMatch.test.ts`, but not exercised end-to-end here —
  flagging honestly rather than claiming full e2e coverage.
- [x] 8.3 Ran the `simplify` pass over the changed files (extracted the
  duplicated `SwipeAction` component in `JobCard.tsx`) and requested code
  review via a subagent — no Critical/Important issues; one real Minor bug
  (`isDismissed` closure identity breaking `index.tsx`'s `useMemo`) found and
  fixed. Tests/tsc/lint re-verified green after.
