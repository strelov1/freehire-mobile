## Why

The mobile feed card shows every skill in the same neutral tint and offers only a
tap-to-save bookmark — there is no sense of how well a job fits the signed-in
user, and no way to dismiss a job that isn't a fit without leaving it cluttering
the feed. The web app (freehire.me) already solves both: a per-card profile-match
bar with green/red skill chips, and a hide (dismiss) action that removes a job
from the feed. Mobile has neither. This change ports both, replacing the mobile
card's static bookmark button with a native swipe gesture (left = save, right =
hide) that matches the reveal-and-commit pattern users already know from mail
apps, and is a better fit for a touch feed than a persistent icon.

## What Changes

- Add a minimal profile data layer to mobile (currently has none): a
  `UserProfile` type (skills only), `getProfile()`, and a `useProfile()` query
  hook — a deliberately narrow port of the concept `add-apply-profile-filters`
  will later need in full; this change does not depend on that one landing.
- Add client-side skill-match computation (`computeClientMatch`, ported from the
  web's `jobMatch.ts`): exact case-insensitive overlap between a job's skills and
  the signed-in user's profile skills, no per-card network request.
- Recolor `JobCard`'s skill chips: brand tint for a skill the user's profile has,
  destructive tint for one it doesn't. Falls back to the current neutral tint
  when there's nothing to compare against (signed out, or no profile skills).
- Add a match bar under the skill row — "`N% · matched/total skills`" over a
  two-tone track — shown only when a real match was computed.
- Add job-hide (dismiss) to mobile: `dismissJob`/`undismissJob`/`dismissedSlugs`
  API calls and a `useDismissedJobs` hook (mirrors the existing `useSavedJobs`
  shape), wired to the backend's existing dismiss endpoints. Dismissed jobs drop
  out of the feed's job list immediately (optimistic, client-side filter).
- **BREAKING (UI only)**: remove `JobCard`'s always-visible `SaveButton`
  (top-right bookmark). Save and hide become swipe gestures on the card itself
  (left = save, right = hide), built with the already-installed
  `react-native-gesture-handler` + `react-native-reanimated`. No other screen's
  save affordance changes (e.g. the job detail screen keeps its own control).

## Capabilities

### New Capabilities
- `job-card-profile-match`: compute and render a per-card profile skill-match
  bar and color-coded skill chips on the mobile feed card.
- `job-card-swipe-actions`: native swipe-right-to-save / swipe-left-to-hide
  gestures on the mobile feed card, replacing the tap-only bookmark button, plus
  the hide/dismiss data layer that removes a job from the feed.

### Modified Capabilities
<!-- None — openspec/specs/ has no synced capabilities yet (job-feed-filters from
     add-feed-search-filters and the not-yet-merged apply-profile-filters work
     haven't been synced), so there is nothing existing to add a delta against. -->

## Impact

- **Components:** `src/components/JobCard.tsx` (skill chip coloring, match bar,
  swipe gestures, `SaveButton` removed from this card); `src/components/SaveButton.tsx`
  stays for reuse elsewhere but is no longer rendered by `JobCard`.
- **Data/model:** `src/lib/types.ts` gains a minimal `UserProfile` type;
  `src/lib/api.ts` gains `getProfile`, `dismissJob`, `undismissJob`,
  `dismissedSlugs`; new `src/lib/useProfile.ts`, `src/lib/useDismissedJobs.ts`,
  and a small pure `src/lib/jobMatch.ts`.
- **Feed:** `src/app/index.tsx` filters dismissed slugs out of the rendered list
  (mirrors how saved state is read today, but subtractive).
- **API:** reads `GET /api/v1/me/profile` and `GET /api/v1/me/tracking/dismissed`,
  writes `POST`/`DELETE /api/v1/jobs/:slug/dismiss` — all already exist on the
  backend; no server changes.
- **Dependencies:** none new — `react-native-gesture-handler` (~2.32) and
  `react-native-reanimated` (4.5.0) are already installed.
- **Tests:** unit tests for `computeClientMatch` and the dismissed-jobs
  optimistic mutation shape.
