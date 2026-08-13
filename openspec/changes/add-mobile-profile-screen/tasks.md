## 1. Location summary formatting (TDD, framework-free)

- [x] 1.1 Write failing tests in a new `src/lib/format.test.ts` for `profileLocationSummary(loc: LocationPreferences | null): string[]`: `null` → `[]`; work-modes-only profile → one line via `facetValueLabel('work_mode', …)` joined with ", "; remote reach (regions via `facetValueLabel('regions', …)`, countries uppercased) → one line; base (country/city, either or both present) → one line; relocation targets → one line, included only when `relocation.open` is true (omitted when `open` is false even if targets are present); a profile with every part present → all lines in a fixed order, each part independently omitted when it has no data.
- [x] 1.2 Implement `profileLocationSummary` in `src/lib/format.ts`, reusing the existing `WORK_MODE_LABELS`/`REGION_LABELS` maps and `label()`/`humanize()` helpers already in that file, until the tests pass.

## 2. Route rename: account → profile

- [x] 2.1 `git mv src/app/account.tsx src/app/profile.tsx`.
- [x] 2.2 Update the `Stack.Screen` entry in `src/app/_layout.tsx` from `name="account"` to `name="profile"`.
- [x] 2.3 Update `router.push(user ? '/account' : '/auth')` in `src/app/index.tsx` to `/profile`.

## 3. Profile screen: drop push UI, add the Profile section

- [x] 3.1 In `profile.tsx`, remove the push `Switch`, the "Send test notification" `Pressable`, the `onTogglePush`/`onTestPush` handlers, the `testResult` state, the `usePushNotifications` import/call, and the now-unused `ActivityIndicator`/`Switch` imports if nothing else in the file uses them.
- [x] 3.2 Add `useProfile()` (from `@/lib/useProfile`) to `profile.tsx` and render a new "Profile" section between Identity and Sign out: specialization chips (`facetValueLabel('category', v)`), skill chips (raw token), and the `profileLocationSummary(profile.location_preferences)` lines — each only rendered when its source array/value is non-empty.
- [x] 3.3 Render the loading state (spinner) while `useProfile()` is pending, and the empty-state message ("No profile saved yet" + a pointer to freehire.dev/my/profile) when the query has resolved to `null`, per `specs/mobile-profile-view/spec.md`.
- [x] 3.4 Add styles for the chips/location lines, following the existing badge/chip visual pattern already in `profile.tsx` (`styles.badge`/`styles.badgeText`) rather than inventing a new one.

## 4. Verify, simplify, review

- [x] 4.1 Run `npm run lint`, `npx tsc --noEmit`, and `npm test` — all green.
- [x] 4.2 Manually verify in the iOS simulator (via the `run` skill): a signed-in user with a saved profile sees specialization/skill chips and the expected location lines; a signed-in user with no saved profile sees the empty-state copy; the push switch and test-notification button are gone; Sign out still works; the account icon on the feed opens `/profile`.

## 5. Profile fetch error state (post-review fix)

- [x] 5.1 In `profile.tsx`, read `isError` from `useProfile()` and render a distinct error message ("Couldn't load your profile.") before the `profile === null` empty-state check, so a failed fetch is never shown as "No profile saved yet".
- [x] 5.2 Run `npm run lint`, `npx tsc --noEmit`, and `npm test` — all green.
