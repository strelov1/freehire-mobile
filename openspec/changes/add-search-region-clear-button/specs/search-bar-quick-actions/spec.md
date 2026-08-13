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

### Requirement: Region shortcut opens a dedicated Region + Work format screen
Tapping the region shortcut button SHALL navigate to a dedicated screen
showing only the Region and Work format facets, without performing any
selection itself. The main Filters screen SHALL NOT render Region or Work
format — those facets live only on this dedicated screen.

#### Scenario: Tapping the region shortcut
- **WHEN** the user taps the region shortcut button on the feed
- **THEN** the app navigates to a screen showing only Region and Work
  format facet sections, with a staged-selection + "Show N jobs" footer
  matching the main Filters screen's pattern

#### Scenario: Applying from the dedicated screen
- **WHEN** the user selects one or more Region/Work format values on the
  dedicated screen and taps "Show N jobs"
- **THEN** the selections are applied to the feed exactly as they would be
  from the main Filters screen

#### Scenario: Opening the main Filters screen
- **WHEN** the user opens the main Filters screen via the existing trailing
  Filters button
- **THEN** the screen shows every facet except Region and Work format
  (Employment, Seniority, Skills, Posted within, Country, Category)

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
