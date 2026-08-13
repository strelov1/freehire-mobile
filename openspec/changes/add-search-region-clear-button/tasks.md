## 1. Region label helper (TDD, pure function)

- [x] 1.1 Write failing tests for a `regionShortcutLabel(selected: string[]): string` helper (new export in `src/lib/jobFilters.ts` or `src/lib/format.ts`): returns `"Region"` for `[]`, the single facet label for one value, and `` `${label} +${n-1}` `` for multiple values.
- [x] 1.2 Implement `regionShortcutLabel` using the existing `facetValueLabel('regions', code)` until tests pass.

## 2. Region shortcut button (`src/app/index.tsx`)

- [x] 2.1 Add the leading region button inside `styles.search`, before the magnifying-glass icon: icon `globe` (expo-symbols), label from `regionShortcutLabel(filters.facets.regions ?? [])`, tint `c.brandStrong`/`c.mutedForeground` selected/unselected, `numberOfLines={1}`, `maxWidth: 100`, mirrored divider style (`borderRightWidth`) of the existing trailing `filtersInInput`.
- [x] 2.2 Wire its `onPress` to `router.push('/filters?focus=regions')`.
- [x] 2.3 Manually verify: no region selected shows "Region" muted; one region shows its label highlighted; two+ regions show "`<label>` +N".

## 3. Scroll-to-Region in Filters modal (`src/app/filters.tsx`)

- [x] 3.1 Read the `focus` param via `useLocalSearchParams<{ focus?: string }>()`.
- [x] 3.2 Add a `ScrollView` ref, a `regionY` state, and an `onLayout` on the `regions` facet's section `View` (inside the existing `FACETS.map`) that records `y` once.
- [x] 3.3 Add a one-shot effect (guarded so it fires at most once per mount) that scrolls to `regionY` when `focus === 'regions'` and `regionY` is known.
- [x] 3.4 Manually verify: opening Filters via the region shortcut scrolls the Region section into view; opening via the existing trailing Filters button (no `focus` param) opens at the top as before.

## 4. Clear button for the search query (`src/app/index.tsx`)

- [x] 4.1 Add a conditional clear `Pressable` (`SymbolView name="xmark.circle.fill"`) between the `TextInput` and the trailing Filters button, shown only when `filters.q.length > 0`, calling `setQuery('')`.
- [x] 4.2 Manually verify: typing shows the clear button; tapping it empties the input and hides the button; the Country search box in the Filters modal is untouched (no clear button added there).

## 5. Verify, simplify, review

- [x] 5.1 Run unit tests and `tsc --noEmit`.
- [x] 5.2 Run `npm run lint`.
- [x] 5.3 Verify end-to-end in the iOS simulator against all scenarios in `specs/search-bar-quick-actions/spec.md`.
- [x] 5.4 Run the `simplify` pass over the changed files, then request code review.

## 6. Revision — dedicated Region + Work format screen (`/filters/quick`)

Supersedes section 3: Region no longer renders inside `/filters` at all, so
the scroll-to-Region mechanism from section 3 is removed rather than reused.

- [x] 6.1 Extract the `Chip` component and `useDebounced` hook out of
      `src/app/filters.tsx` into shared modules (e.g.
      `src/components/Chip.tsx`, `src/lib/useDebounced.ts`) so both `/filters`
      and the new `/filters/quick` can use them without duplication.
- [x] 6.2 Create `src/app/filters/quick.tsx`: a full-screen modal mirroring
      `/filters`'s staged-copy + `useFacetCounts` + Clear/Show-N-jobs footer
      pattern, but rendering only the `work_mode` and `regions` entries from
      `FACETS`.
- [x] 6.3 Register `Stack.Screen name="filters/quick"` with
      `presentation: 'modal'` in `src/app/_layout.tsx`.
- [x] 6.4 In `src/app/filters.tsx`, render
      `FACETS.filter(f => f.param !== 'work_mode' && f.param !== 'regions')`
      instead of the full `FACETS` list.
- [x] 6.5 Remove the `focus` param handling, `regionY` state, `onLayout`, and
      scroll-to-Region effect from `src/app/filters.tsx` (dead now that
      Region isn't rendered there).
- [x] 6.6 In `src/app/index.tsx`, point the region shortcut button's
      `onPress` at `router.push('/filters/quick')` instead of
      `/filters?focus=regions`.
- [x] 6.7 Shrink the region shortcut button: `maxWidth` 100→76, label
      `fontSize` 14→13, icon/label `gap` 5→4.
- [x] 6.8 Manually verify: tapping the region button opens `/filters/quick`
      showing only Region + Work format; selecting values and tapping
      "Show N jobs" applies them and updates the feed same as before; the
      main `/filters` screen no longer shows Region or Work format sections;
      the region button is visibly narrower and no longer crowds the search
      input.
- [x] 6.9 Run unit tests, `tsc --noEmit`, `npm run lint`; simplify + review
      the diff.

## 7. Revision — add Employment to `/filters/quick`

- [x] 7.1 Extract `QUICK_FACET_PARAMS` into `src/lib/jobFilters.ts` (single
      source of truth for `filters.tsx`'s exclusion filter and
      `quick.tsx`'s inclusion filter) and add `employment_type` to it.
- [x] 7.2 Update `quick.tsx`'s `clearAll()` to clear all `QUICK_FACET_PARAMS`
      generically instead of naming `work_mode`/`regions` individually.
- [x] 7.3 Retitle the quick screen "Quick filters" (was "Region & Work
      format", no longer accurate with three facets).
- [x] 7.4 Manually verify: `/filters/quick` shows Work format, Employment,
      and Region; the main Filters screen no longer shows any of the three.
