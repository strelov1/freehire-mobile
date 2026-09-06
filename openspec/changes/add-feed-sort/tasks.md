## 1. The vocabulary

- [x] 1.1 `src/lib/jobFilters.ts` — `JobSort`, `defaultSortFor(q)`, `effectiveSort(f)`,
      `sortOptionsFor(q)`, `selectedSortFor(f)`, `matchSortNeedsSkills(f, hasSkills)` and the
      `SORT_PARAM` map in which relevance deliberately has no entry. Ported from the web's
      `facetModel.ts`.
- [x] 1.2 `filtersToQuery` serializes the effective sort, writing nothing for relevance.
- [x] 1.3 `JobFilters` gains `sort: JobSort | null`; `emptyFilters` starts unchosen.
- [x] 1.4 Tests: the options per query state, the collapse of relevance and the survival of views,
      the default serializing to nothing, and the match notice's three states.

## 2. The control

- [x] 2.1 `src/components/SortMenu.tsx` — a button naming the ordering in force, dropping its
      options directly beneath itself. React Native has no `<select>` and no anchored popover, so
      the trigger measures itself on press and the menu is positioned from that. A centred dialog
      was the first attempt and the wrong shape: a box in the middle of the screen reads as a
      decision to make, and this is a control to adjust.
- [x] 2.2 `src/app/(tabs)/index.tsx` — the count and the control on one line, the web's toolbar in
      miniature, applying on the tap.
- [x] 2.3 The notice under it when best match is in force with no skills to rank against.

## 3. Verification

- [x] 3.1 `npm run lint` and `npx tsc --noEmit` clean.
- [x] 3.2 Unit tests pass: 538 across 56 suites.
- [x] 3.3 By hand on a simulator: the menu drops under its button, `sort=match` really reorders
      (100% matches to the top), and Relevance is absent while the search box is empty.
- [ ] 3.4 The no-skills notice was not seen: the account on the simulator has skills, so the state
      it explains could not be reached. Covered by unit tests only.
