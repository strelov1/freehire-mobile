## Why

The feed serves one ordering and never says which. Every request goes out without a `sort`
parameter, so the server applies its own default — relevance under query text, freshest first
without it — and the reader has no way to ask for anything else.

The web has had the choice all along: newest, most viewed, and best match against the reader's own
profile skills. That last one is the ordering that answers "which of these actually suit me", and it
is the one this app has the least excuse for missing, having just landed the per-job match it is the
list-wide version of.

## What Changes

- **A sort control above the feed**, beside the result count: Relevance (only with query text),
  Newest, Most viewed, Best match. Changing it re-runs the search immediately — sorting is not a
  filter and should not need the Filters modal and its "Show N jobs" button.
- **The default is not stated, it is mirrored.** `relevance` has no wire value: the endpoint spells
  it as no `sort` parameter at all, so serializing the default means writing nothing, and "our
  default" cannot drift from "what the server does with no parameter".
- **`relevance` collapses when the query is cleared** — it has nothing left to rank — and only it:
  `views` ranks by a stored figure and stays perfectly servable, so discarding that choice would be
  a bug rather than a fallback.
- **Best match is offered to everyone**, including readers with no profile skills. Hiding it would
  hide the reason to fill in a profile from exactly the people who have not. Choosing it without
  skills is answered out loud instead: the server quietly serves newest, and the feed says so.

## Capabilities

### New Capabilities

- `job-feed-sort`: which orderings the feed offers, which one is in force, how each serializes, and
  what the feed says when the chosen ordering has nothing to rank against.

## Impact

- **Source:** `src/lib/jobFilters.ts` (the sort vocabulary and its serialization, ported from the
  web's `facetModel.ts`), its tests, and `src/app/(tabs)/index.tsx` for the control.
- **Backend:** none. `?sort=` and `?order=` already exist; `order` is not sent, its `desc` default
  being the only direction any of these orderings wants.
- **Not in this change:** the web's minimum-match slider, which filters rather than orders.
