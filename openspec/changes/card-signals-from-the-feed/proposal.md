## Why

Sorting by "Most viewed" landed a feed ordered by a number the cards did not show. The order looked
arbitrary, because the evidence for it was thrown away: `/jobs/search` serves `view_count` on every
hit and the card dropped it.

Pulling that thread found more of the same. The feed also serves the full `reality` signal, the
applied count, `collections` and `countries` — and the card renders none of them, while the web's
JobRow renders all of them. One of those omissions is worse than a missing figure: `reality` is the
trust verdict that says a posting has been open 75 days or reads as evergreen, and the card is the
surface people scan fastest and least critically.

A stale comment explains how it happened. `src/lib/types.ts` marked `reality` as "detail endpoint
only", which was never true of the search feed.

## What Changes

- **The view count is shown** beside the timestamp, abbreviated (1.2K) for a rail it shares with a
  truncating company name. Assistive technology hears the exact figure. Zero renders nothing: "0
  views" reads as a dead posting rather than a new one.
- **The reality badge comes to the card** — the same component the job screen already uses.
- **Freshness badges**: "New", and "Be an early applicant" when the posting is very recent and few
  people have said they applied.
- **The company screen's header shrinks** into its back rail, matching the job screen. A 48px logo
  above its own name spent a fifth of the screen restating the row below and pushed the open roles —
  the reason for the visit — under the fold.
- **The company description collapses to three lines**, expandable, as the web's CompanyAbout does.
  Some of these summaries run a dozen paragraphs and filled the whole screen. The toggle appears
  only when the text actually overflows — measured, not guessed from a character count.

## Bug fixed on the way

The match strip's label printed past the card's right edge on cards whose text ran long. The blur
wrapper introduced with the teaser rendered the strip's style on an outer view AND an inner one, so
the inner copy sized to its content and the label was measured against that rather than the card.
The blur is now a sibling laid over the strip rather than a box around it, which also removes a
whole level of nesting.

## Capabilities

### Modified Capabilities

- `job-card-profile-match`: the card's rail and signal row gain the figures and verdicts the feed
  already serves.

## Impact

- **Source:** `src/components/JobCard.tsx`, `src/lib/reality.ts` (`freshnessBadges`),
  `src/lib/format.ts` (`formatCount`), `src/app/companies/[slug].tsx`, and the corrected comment in
  `src/lib/types.ts`.
- **Backend:** none. Every value was already on the wire.
- **Not in this change, and still missing from the card:** the country flag cluster, the
  backer/credential badges built from `collections`, the "you have viewed this" marker, and the
  up/down vote counts. Each needs a component or a vocabulary the app does not have yet.
