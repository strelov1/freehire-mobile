## Why

The feed's search bar (`src/app/index.tsx`) requires opening the full-screen
Filters modal to see or change the selected region, and offers no way to
clear typed search text except deleting characters one by one. The web app
(`../hire`) solves both with affordances built into the search bar itself: a
region button to the left of the input, and a clear ("X") button that
appears once text is typed. This change ports both patterns to mobile,
reusing the existing `regions` facet and Filters modal rather than building
new picker UI. Design details are captured in
`docs/superpowers/specs/2026-08-13-search-bar-region-button-and-clear-x-design.md`.

## What Changes

- Add a region shortcut button to the **left** of the search bar's
  `TextInput` (`src/app/index.tsx`), mirroring the existing trailing
  Filters button. It shows the currently applied region selection ("Region"
  when none, the region label when one, "`<label>` +N" when several) and,
  on tap, navigates to the Filters modal scrolled to the Region section. It
  does not itself select anything — selection stays in the existing chips.
- Add a scroll-to-section mechanism to the Filters modal
  (`src/app/filters.tsx`): a `focus` route param that, when set to
  `"regions"`, scrolls the modal to the Region facet section on open.
- Add a clear ("X") button inside the main search `TextInput` (feed screen
  only), visible only when there is query text, clearing it in one tap via
  the existing `setQuery`.

Out of scope: the Filters modal's Country search box (no clear button
there), any new popover/bottom-sheet component, any change to how region
values are selected, staged, or serialized.

## Capabilities

### New Capabilities
- `search-bar-quick-actions`: quick-access affordances built into the feed's
  search bar — a region-selection shortcut (display + navigate-to-Filters)
  and a clear button for the typed query.

### Modified Capabilities
<!-- None — openspec/specs/ has no synced capabilities yet to modify against. -->

## Impact

- **Screens:** `src/app/index.tsx` (search bar gains a leading region button
  and a conditional trailing clear button); `src/app/filters.tsx` (reads a
  `focus` param and scrolls to the Region section on open).
- **Data/model:** no changes — reuses `filters.facets.regions` from
  `useFilters()`, `facetValueLabel('regions', code)` from `src/lib/format.ts`,
  and the existing `FACETS` region entry in `src/lib/jobFilters.ts`.
- **Navigation:** `router.push('/filters?focus=regions')` instead of
  `router.push('/filters')` when opened from the new region button.
- **Tests:** no new unit-testable logic beyond a small label-derivation
  helper (single vs. multi region label with `+N`), which is pure and worth
  a unit test; the scroll-to-section behavior and clear button are UI-only
  and verified manually (consistent with how `filters.tsx`/`index.tsx` were
  originally built).
