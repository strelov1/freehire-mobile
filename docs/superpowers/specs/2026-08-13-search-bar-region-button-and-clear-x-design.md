# Search bar: region shortcut button + clear (X) button

Date: 2026-08-13

## Context

The web app (`../hire`) puts a region/location filter button inside the search
bar itself, to the left of the search icon, separated by a thin divider — and
its search inputs show a clear ("X") button once text is typed. Neither
pattern exists in the mobile app today. This spec covers porting both ideas
into `src/app/index.tsx`'s search bar, reusing the existing `regions` facet
and Filters modal rather than building new picker UI.

Relevant existing code:
- `src/app/index.tsx` — the feed's pinned search bar. Already has a trailing
  "Filters" button living inside the search field (`styles.filtersInInput`,
  divider via `borderLeftWidth`).
- `src/app/filters.tsx` — the full-screen Filters modal. `regions` is already
  one of the `FACETS` (index 3 of 5), rendered as a generic chip group; no
  scroll-to-section mechanism exists yet.
- `src/lib/jobFilters.ts` — `FACETS`, `toggleValue`, `activeFilterCount`.
- `src/lib/filterStore.tsx` — `useFilters()` exposes the *applied* `filters`
  (not the staged copy used inside the Filters modal).
- `src/lib/format.ts` — `facetValueLabel('regions', code)` for display labels.

## Goals

1. A region shortcut button on the **left** of the search bar's `TextInput`,
   mirroring the existing filters button on the right. Tapping it navigates
   into the existing Filters modal, scrolled to the Region section. It does
   not do any selection itself — selection stays in the existing chips.
2. A clear ("X") button inside the main search `TextInput` (index.tsx only),
   visible only when there is query text, clearing it in one tap.

Out of scope: the Filters modal's own Country search box (no X added there
per user decision), any new popover/bottom-sheet component, any change to
how region values are selected or serialized.

## Design

### 1. Region shortcut button (`src/app/index.tsx`)

New element inside `styles.search`, placed **before** the magnifying-glass
icon, mirroring `filtersInInput` but flipped:

```tsx
<Pressable
  onPress={() => router.push('/filters?focus=regions')}
  hitSlop={8}
  style={({ pressed }) => [
    styles.regionInInput,
    { borderRightColor: c.border },
    pressed && { opacity: 0.6 },
  ]}>
  <SymbolView name="globe" size={17} tintColor={regionCount > 0 ? c.brandStrong : c.mutedForeground} />
  <Text
    numberOfLines={1}
    style={[styles.regionLabel, { color: regionCount > 0 ? c.brandStrong : c.mutedForeground }]}>
    {regionLabel}
  </Text>
</Pressable>
```

```ts
regionInInput: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  alignSelf: 'stretch',
  maxWidth: 100,
  paddingRight: Space.sm,
  marginRight: Space.xs,
  borderRightWidth: 1,
},
regionLabel: {
  fontSize: 14,
  fontWeight: '500',
  flexShrink: 1,
},
```

Label logic (derived from the *applied* `filters`, same source as
`activeCount`):

```ts
const selectedRegions = filters.facets.regions ?? [];
const regionLabel =
  selectedRegions.length === 0
    ? 'Region'
    : selectedRegions.length === 1
      ? facetValueLabel('regions', selectedRegions[0])
      : `${facetValueLabel('regions', selectedRegions[0])} +${selectedRegions.length - 1}`;
```

Icon and label tint follow the same selected/unselected convention as the
Filters button (`c.brandStrong` vs `c.mutedForeground`).

### 2. Scroll-to-region in the Filters modal (`src/app/filters.tsx`)

- Read the nav param: `const { focus } = useLocalSearchParams<{ focus?: string }>();`
- Add a `ScrollView` ref (`const scrollRef = useRef<ScrollView>(null)`) and a
  `regionY` state (`useState<number | null>(null)`).
- The `regions` facet's `View` (inside the existing `FACETS.map`) gets an
  `onLayout` that records its `y` the first time, only for that one facet:
  ```tsx
  onLayout={
    facet.param === 'regions'
      ? (e) => setRegionY(e.nativeEvent.layout.y)
      : undefined
  }
  ```
- A `useEffect` fires once both `focus === 'regions'` and `regionY != null`,
  calling `scrollRef.current?.scrollTo({ y: regionY, animated: true })`, then
  clears a "done" flag (e.g. a ref) so it doesn't re-trigger on later
  layout passes.

No change to how region chips are selected, staged, or committed — this is
purely a one-time scroll-into-view on open.

### 3. Clear (X) button (`src/app/index.tsx` only)

Inside `styles.search`, after the `TextInput` and before the region-button's
mirror on the right (i.e. before `filtersInInput`):

```tsx
{filters.q.length > 0 ? (
  <Pressable onPress={() => setQuery('')} hitSlop={8}>
    <SymbolView name="xmark.circle.fill" size={16} tintColor={c.mutedForeground} />
  </Pressable>
) : null}
```

Uses the existing `setQuery` from `useFilters()` — same code path as typing.
No change to `src/app/filters.tsx`'s country search box.

## Testing

- Manual: type in search → X appears, tap clears it and refocuses nothing
  extra (input stays focused).
- Manual: select a region in Filters, back out → shortcut button shows the
  region label and highlighted tint; select two → shows "X +1".
- Manual: tap the shortcut button from the feed → Filters opens already
  scrolled so the Region section is visible without manual scrolling.
- No unit tests planned — this app has no existing component test setup for
  screens under `src/app/`; behavior is covered by manual verification only,
  consistent with how `filters.tsx`/`index.tsx` were built.
