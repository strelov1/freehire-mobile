## Context

The feed's pinned search bar (`src/app/index.tsx`) already has one
in-field affordance: a trailing "Filters" button living inside the bordered
search container, separated by a `borderLeftWidth` divider
(`styles.filtersInInput`). The `regions` facet is fully wired end-to-end
(`src/lib/jobFilters.ts` FACETS[3], staged/apply flow, chip UI) inside the
full-screen Filters modal (`src/app/filters.tsx`), but is otherwise invisible
from the feed — a user has to open Filters and scroll to see or change it.
The search `TextInput` has no clear affordance at all (not even RN's
`clearButtonMode`, which is iOS-only and wouldn't match the app's SF-Symbols
icon convention).

Full exploration and the originally negotiated design live in
`docs/superpowers/specs/2026-08-13-search-bar-region-button-and-clear-x-design.md`;
this document restates the decisions in OpenSpec's design format.

The app has no popover/bottom-sheet library (`@gorhom/bottom-sheet` etc. are
not installed) — the only "overlay" pattern in the codebase is a full-screen
`expo-router` modal route (`presentation: 'modal'`), used for `filters`,
`auth`, `account`, `notifications`.

## Goals / Non-Goals

**Goals:**
- Surface the currently applied region selection directly in the search bar,
  and let the user jump straight to the Region section of Filters in one tap.
- Let the user clear typed search text in one tap instead of deleting
  character by character.
- Reuse 100% of the existing region-selection logic (chips, `toggleValue`,
  staged/apply) and the existing filter store — no duplicated state.

**Non-Goals:**
- No new popover/bottom-sheet/anchor-menu component. The region button opens
  the existing Filters modal; it does not do inline selection itself.
- No change to how region values are chosen, staged, committed, or
  serialized to the API query string.
- No clear button on the Filters modal's Country search box (explicitly
  decided against — scope stays limited to the main feed search bar).
- No persistence of the `focus` scroll target beyond the single navigation
  (re-opening Filters without the param behaves exactly as today).

## Decisions

**Region button opens the existing full-screen Filters modal, scrolled to
Region, instead of a new lightweight popover.**
Alternative considered: a new anchored popover/bottom-sheet mirroring the
web's `HeaderLocationFilter` popover more closely. Rejected because the app
has zero popover/sheet infrastructure today — building one is disproportionate
to the value of this change, and would duplicate the region-chip logic that
already exists in `filters.tsx`. Reusing the modal keeps this change additive
and low-risk (see also the user's explicit choice during brainstorming).

**The region button is a pure navigation shortcut with a derived label, not
a selection control.**
It reads the *applied* `filters.facets.regions` (same source as the existing
`activeFilterCount` badge on the Filters button), not any staged/local copy.
Label: `"Region"` (none selected) / `facetValueLabel('regions', code)` (one)
/ `` `${label} +${n-1}` `` (multiple). This mirrors the existing Filters
button's selected/unselected tint convention (`c.brandStrong` vs
`c.mutedForeground`) instead of inventing a new visual language.

**Scroll-to-section via a `focus` route param + `onLayout` + `scrollTo`, not
a new "scoped filters" screen or tab.**
Alternative considered: a dedicated `/filters/region` route (isolates the
region UI, but forks the staged-state/apply logic into two places — rejected
for duplicating what `filters.tsx` already does end-to-end). The chosen
approach adds ~10 lines to `filters.tsx`: read `focus` via
`useLocalSearchParams`, capture the region section's `y` via `onLayout` only
on that one facet, and call `scrollRef.current?.scrollTo({ y, animated: true })`
once both are known. No other facet section is touched.

**Clear button uses `xmark.circle.fill` (expo-symbols), conditional on
`filters.q.length > 0`, calling the existing `setQuery('')`.**
Matches the project's exclusive icon convention (`expo-symbols`/SF Symbols;
no `lucide-react-native` or custom SVGs are used anywhere in this codebase)
and reuses the existing `setQuery` — no new state.

## Risks / Trade-offs

- **[Risk]** `onLayout` fires on every re-render of the regions section
  (e.g., when facet counts change), which could re-trigger `setRegionY` and,
  if not guarded, re-scroll after the user has already scrolled away.
  → **Mitigation:** gate the scroll effect with a one-shot ref (e.g.
  `hasScrolledRef`) so it fires at most once per modal mount, regardless of
  how many times `onLayout` reports a new `y`.
- **[Risk]** The region button's label has limited horizontal space in the
  search row (shared with the `TextInput`, notification bell, and avatar);
  a long region label ("North America") could crowd out the input.
  → **Mitigation:** fixed `maxWidth: 100` + `numberOfLines={1}` on the label,
  matching the truncation approach already used for the badge/label pairing
  on the trailing Filters button.
- **[Trade-off]** Because the region button reflects *applied* filters only,
  it will not update while the user is mid-edit inside the Filters modal
  (staged but not yet applied) — consistent with the existing Filters-button
  badge, which has the same property today.

## Migration Plan

Additive UI change to two existing screens; no data migration, no API
changes, no breaking changes to the filter model. Ships as a normal PR;
no feature flag needed given the small blast radius (two files). Rollback
is a plain revert.

## Open Questions

None outstanding — all design points were confirmed with the user during
brainstorming (see the linked spec doc) before this OpenSpec change was
created.
