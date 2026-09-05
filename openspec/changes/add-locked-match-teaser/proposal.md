## Why

A signed-out visitor is currently told, in a sentence, that signing in would show them a match. The
web tells them the same thing by showing them one — blurred: plausible figures over the job's own
skills, an invitation rather than an estimate. It converts because the value is visible rather than
described.

The same applies to a signed-in user with no profile skills, and to the feed's cards, where the
strip that shows a real viewer their coverage currently shows a locked one nothing at all.

## What Changes

- **Locked viewers see a blurred teaser instead of a bare line.** Both on the job screen and on the
  feed's cards, in both locked states — signed out, and signed in without profile skills.
- **The figures are derived from the job's slug**, so the same job reads the same on every render.
  A card that re-rolled its score as a list scrolled would be caught out immediately.
- **The teaser is built from the job's own skills**, never a fabricated list, and its matched count
  follows from its percent — so the "N of M skills" label cannot contradict the bar beside it.
- **A job with fewer than two skills gets no teaser.** There is no have/missing contrast to draw,
  and "1 of 1 skills" beside a part-filled bar is the one figure a viewer could disprove.
- **It is never announced as a score.** The blurred figures are hidden from assistive technology,
  which is offered the invitation to sign in in their place. A screen reader must not be read a
  fabricated percentage as though it were the user's own.
- **The blur covers the figures only.** On a card, the salary stays legible — the teaser is an
  invitation, not a paywall over the job.

## Capabilities

### Modified Capabilities

- `job-profile-match`: the `guest` and `no-profile` states gain the blurred teaser above their
  existing call-to-action.
- `job-card-profile-match`: a locked viewer's card gains the teaser — tinted chips and a coverage
  strip under a blur — where it currently shows neutral chips and no strip.

## Impact

- **Dependencies:** `expo-blur` (~57.0.2). An Expo module covered by autolinking, no config plugin,
  no entitlement — so it does not invalidate the iOS provisioning profile (`AGENTS.md`). Native
  modules already require a development build here.
- **Source:** `src/lib/jobMatch.ts` (`matchTeaser`, `teaserChips`), its tests,
  `src/components/JobMatchBlock.tsx`, `src/components/JobCard.tsx` and their tests.
- **Backend:** none, and by design: no locked state makes a request. The teaser is derived on the
  device from data the card already has.
- **Not in this change:** claiming or avoiding a skill, which is the last of the five.
