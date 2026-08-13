## Context

`JobCard` (`src/components/JobCard.tsx`) currently renders skills as uniformly
brand-tinted chips and a persistent top-right `SaveButton` (bookmark). Saving
already exists end-to-end (`useSavedJobs`, `saveJob`/`unsaveJob`/`savedSlugs` in
`src/lib/api.ts`) — this change reuses that shape for a sibling "dismiss" concept
and adds a presentational layer (match bar, chip tint) on top of both.

The web app (`hire/web`) already has every piece being ported here:
- `web/src/lib/jobMatch.ts::computeClientMatch` — pure, client-side, exact
  case-insensitive overlap between a job's skills and the viewer's profile
  skills. No adjacency/fuzzy matching (that's server-side, a different
  endpoint) — deliberately the "free" signal that costs zero requests per card.
- `web/src/lib/components/JobMatchBar.svelte` — a thin two-tone bar
  (brand fill = matched, destructive/15 track = missing) plus a
  "`N% · matched/total`" label, rendered only when there's a real match.
- `web/src/lib/components/JobRow.svelte` — chip tint (`brand` vs `missing`) from
  the same overlap; a hide button that optimistically marks the job dismissed,
  calls `POST /jobs/:slug/dismiss`, and rolls back on failure.
- `web/src/lib/dismissedJobs.svelte.ts` — a `SlugSet`-based store, structurally
  identical to `savedJobs.svelte.ts`.

**Update, discovered during implementation:** at proposal time,
`add-apply-profile-filters` was unmerged (only on
`worktree-add-apply-profile-filters`), so this design originally planned a
standalone minimal `UserProfile`. It has since landed on `master` — this
change's worktree (branched fresh from `origin/master`) already has the full
`UserProfile` (`specializations`, `skills`, `excluded_skills`,
`location_preferences`), `getProfile()`, and `useProfile()`. This change now
simply reuses them (reading only `.skills`) instead of adding its own —
task group 3 in `tasks.md` is a no-op reuse, not new code.

The web's full-screen swipe deck (`SwipeDeck.svelte`, `/jobs/swipe`) is a
separate Tinder-style card-stack mode with its own route, filters, and undo —
explicitly **not** what this change ports. What's being built here is inline
row-level swipe actions on the existing scrollable feed, the same interaction
family as iOS Mail's swipe-to-archive/swipe-to-delete.

## Goals / Non-Goals

**Goals:**
- Render the same have/missing signal the web shows: colored skill chips + a
  match bar, computed from the signed-in user's profile skills.
- Let a user save or hide a job from the feed with a swipe, without a
  persistent icon button occupying card real estate.
- Persist hide (dismiss) server-side via the existing endpoints, so a hidden
  job stays out of the feed across sessions/devices, matching web behavior.

**Non-Goals:**
- No fuzzy/adjacent skill matching (server-side `GET /jobs/:slug/match` scoring)
  — client-side exact overlap only, matching the web card's own scope.
- No guest/no-profile "teaser" blur invitation (`matchTeaser` on web). Signed
  out or no profile skills: chips stay in their current neutral tint and the
  match bar simply doesn't render. Simpler, and this change's `UserProfile` is
  intentionally too narrow to seed a believable teaser.
- No full-screen swipe-deck mode, no undo affordance, no "Hidden jobs" list
  screen. The backend's `DELETE /jobs/:slug/dismiss` (undismiss) already exists,
  so any of these can be added later without a data-layer change — cut here to
  keep the change minimal, per the scope decision already made with the user.
- No change to the job-detail screen's own save control.

## Decisions

**Swipeable primitive: `ReanimatedSwipeable` from `react-native-gesture-handler`,
not a hand-rolled `PanGestureHandler`.** It's already a transitive dependency
(gesture-handler 2.32 ships it), reanimated-backed (no bridge traffic per
frame), and is exactly the "native elements" the user asked for rather than a
bespoke gesture reimplementation. `renderLeftActions`/`renderRightActions` draw
the revealed action (icon + tint), and the library owns the pan/velocity math.

**Commit model — revised during implementation.** Originally planned as two
independently-reachable paths ("partial drag reveals a tappable action; a
separate, farther fast/far swipe auto-fires"). `Swipeable`'s release
resolution turned out to be binary — a release either snaps fully open (at
`leftThreshold`/`rightThreshold`) or fully closed, with no in-between resting
state to hold a "revealed but not yet committed" action. A true second,
farther auto-commit threshold would require bypassing `Swipeable` for a
hand-rolled `PanGestureHandler`, which this same decision already ruled out.
Shipped instead: `onSwipeableOpen` fires the action the instant a swipe
crosses the (single) threshold — one continuous swipe commits, which is also
the more literal reading of the original ask (one swipe direction saves, the
other hides — not a two-step reveal-then-tap). The revealed action button's
own `onPress` calls the same handler, so tapping it (e.g. via VoiceOver) still
works identically, even though in normal use the swipe itself already
committed by the time the button is visible.

**Direction mapping — swapped once during implementation, per direct user
feedback after the first pass shipped it backwards from what felt natural.**
Final: swiping the row **left** reveals `renderLeftActions` (brand-tinted
bookmark, save); swiping **right** reveals `renderRightActions`
(destructive-tinted eye-slash, hide). `renderLeftActions`/`renderRightActions`
name which side of the row the panel is anchored to, not the swipe direction —
easy to get backwards, which is exactly what happened on the first pass.

**Action panel styling — also revised per feedback: icon-only tint, not a
full-bleed color fill.** The panel background stays the card's own surface
color (`c.card`); only the `SymbolView` icon itself carries the semantic color
(`c.brandStrong` for save, `c.destructive` for hide) — quieter than a solid
green/red block, closer to how the rest of the card's own iconography (e.g.
the reality/ghost badges) already reads.

**Match computation lives in a pure function (`src/lib/jobMatch.ts`), not
inline in `JobCard`.** Directly ports `computeClientMatch`'s signature and
behavior (case-insensitive `Set` overlap, `percent = round(matched/total*100)`,
`total === 0` → 0) so it's unit-testable without rendering anything, same as the
web original.

**Dismissed jobs get their own hook (`useDismissedJobs`), not a flag bolted onto
`useSavedJobs`.** Structurally identical to `useSavedJobs` (query key
`['dismissed']`, optimistic mutate, rollback on error) but a distinct concept —
save and hide are independent and a job can be saved and later hidden. Mirrors
the web keeping `dismissedJobs.svelte.ts` separate from `savedJobs.svelte.ts`.

**The feed (`src/app/index.tsx`) filters dismissed slugs client-side**, the same
way `useSavedJobs` already informs the bookmark's filled state — `useJobSearch`
keeps fetching the normal paginated list, and the screen drops any job whose
slug is in the dismissed set before handing pages to `FlashList`. This avoids
threading a new query param through `searchJobs`/`jobFilters.ts` for a v1 that
only needs client-side removal (the backend also excludes dismissed jobs from
`/jobs/search` for authenticated calls today per the web's own comment in
`dismissedJobs.svelte.ts`, so this is a belt-and-suspenders filter for
optimistic freshness between the dismiss call and the next fetch, not the
primary exclusion mechanism).

**New color tokens (`destructive`, `destructiveMuted`) added to
`FreehirePalette`** (`src/constants/freehire.ts`) rather than hardcoding hex in
`JobCard`: light `#dc2626` (already used ad hoc in `account.tsx:109`, now
promoted to a token), dark `#f87171` (converted from the web's dark
`oklch(0.704 0.191 22.216)` destructive token). `destructiveMuted` is a ~12-15%
alpha tint for the missing-chip background and the match bar's unfilled track,
mirroring the web's `destructive/15` / `destructive/5` Tailwind opacities.

## Risks / Trade-offs

- **Swipe gestures inside a vertically-scrolling `FlashList`** → gesture-handler
  wraps `NativeViewGestureHandler` for the row and RNGH's own list interop
  (already required for `expo-router`'s stack gestures elsewhere in the app)
  handles axis disambiguation; `ReanimatedSwipeable` is designed for exactly
  this (list row swipe) and is the same primitive iOS Mail-style RN apps use,
  so this is a well-trodden path rather than a novel gesture conflict.
- **Removing the always-visible `SaveButton` lowers discoverability of "save"**
  for a first-time user who doesn't know to swipe → mitigated by the tap-to-open
  revealed action (not swipe-only) and by the fact the job detail screen (a tap
  away) keeps its own visible save control, so save is never swipe-only
  app-wide.
- **A user who hides a job by accident has no recovery path in this change** →
  accepted per the non-goals; the dismiss endpoint's DELETE already exists, so
  undo is a follow-up, not a rewrite, when/if it's prioritized.
- **This change's minimal `UserProfile` may need reconciling with
  `add-apply-profile-filters`'s fuller `UserProfile` when that lands** →
  mitigated by keeping this change's type to exactly the `skills` field it
  needs, so a future merge is additive (new fields), not a conflicting
  redefinition.

## Migration Plan

1. Add color tokens, `UserProfile` type, `getProfile`/`useProfile`, and
   `jobMatch.ts` — additive, unwired, unit-tested in isolation.
2. Add `dismissJob`/`undismissJob`/`dismissedSlugs` to `api.ts` and
   `useDismissedJobs` — additive, unwired.
3. Wire `JobCard`: chip tinting + match bar (read-only, no behavior change yet).
4. Wire `JobCard`: replace `SaveButton` with `ReanimatedSwipeable` driving both
   save (right) and hide (left); wire the feed to filter dismissed slugs.
5. Verify end-to-end in the iOS simulator (swipe-to-save, swipe-to-hide, tap the
   revealed action, chip colors for a profile with partial overlap, no crash
   when signed out / no profile / job has no skills), then simplify and request
   review.

Rollback: every new module is additive; `JobCard`'s edits are confined to one
file and its existing `SaveButton` import can be restored if the swipe UX needs
to be reverted independently of the match-bar work.

## Open Questions

- Exact `leftThreshold`/`rightThreshold` and row height are implementation
  details tuned during simulator verification, not a spec requirement.
