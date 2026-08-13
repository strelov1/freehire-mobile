## ADDED Requirements

### Requirement: Region shortcut reflects the applied region selection
The feed's search bar SHALL display a region shortcut button, leading the
search `TextInput`, that reflects the currently *applied* `regions` facet
selection (not any unsaved/staged edit).

#### Scenario: No region selected
- **WHEN** the feed is shown and no `regions` facet value is applied
- **THEN** the region shortcut button shows the label "Region" and an
  unselected (muted) tint

#### Scenario: One region selected
- **WHEN** exactly one `regions` facet value is applied (e.g. `eu`)
- **THEN** the region shortcut button shows that region's display label
  (e.g. "Europe") and a selected (brand) tint

#### Scenario: Multiple regions selected
- **WHEN** more than one `regions` facet value is applied
- **THEN** the region shortcut button shows the first selected region's
  label followed by a count of the remaining selections, formatted as
  `<label> +N` (e.g. "Europe +1" for two selected regions)

### Requirement: Region shortcut opens Filters scrolled to Region
Tapping the region shortcut button SHALL navigate to the Filters screen and
bring the Region facet section into view without the user manually
scrolling, without performing any selection itself.

#### Scenario: Tapping the region shortcut
- **WHEN** the user taps the region shortcut button on the feed
- **THEN** the app navigates to the Filters screen
- **AND** the Filters screen is scrolled so the Region section is visible
  on open, without requiring manual scrolling

#### Scenario: Opening Filters via the existing Filters button
- **WHEN** the user opens the Filters screen via the existing trailing
  Filters button (not the region shortcut)
- **THEN** the Filters screen opens at its normal top scroll position,
  unaffected by the region shortcut's scroll behavior

### Requirement: Clear button for the feed search query
The feed's search `TextInput` SHALL show a clear button whenever it
contains text, letting the user empty it in a single tap.

#### Scenario: Typing text shows the clear button
- **WHEN** the user types any character into the feed search input
- **THEN** a clear button appears at the trailing edge of the input

#### Scenario: Tapping the clear button empties the query
- **WHEN** the feed search input contains text and the user taps the clear
  button
- **THEN** the search query is cleared
- **AND** the clear button is hidden again since the input is now empty

#### Scenario: Empty input shows no clear button
- **WHEN** the feed search input is empty
- **THEN** no clear button is shown
