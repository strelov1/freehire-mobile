## ADDED Requirements

### Requirement: Company directory listing

The Companies tab SHALL render a paginated list of companies fetched from `GET /api/v1/companies`, replacing the static placeholder. It SHALL load further pages as the user scrolls, walking `offset` forward until the loaded count reaches `meta.total`, and SHALL stop requesting pages once every company has been loaded.

#### Scenario: First page renders

- **WHEN** the Companies tab is opened
- **THEN** it requests the first page of `GET /api/v1/companies` with a page size of 20 and renders one card per returned company

#### Scenario: Scrolling loads the next page

- **WHEN** the user scrolls near the end of the loaded companies and more remain (`meta.offset + data.length < meta.total`)
- **THEN** the next page is requested at the next `offset` and appended to the list

#### Scenario: The catalog is exhausted

- **WHEN** the loaded company count has reached `meta.total`
- **THEN** no further page request is made when the user scrolls to the end

#### Scenario: Total count is shown

- **WHEN** the list has loaded at least one company
- **THEN** the screen displays `meta.total` as a thousands-separated company count above the list

### Requirement: Company search

The directory SHALL provide a text field that searches companies via the endpoint's `q` parameter. The typed value SHALL be debounced before it reaches the network, and only the settled value SHALL take part in the request and its cache key. An empty search SHALL omit `q` from the request entirely.

#### Scenario: Typing issues one request for the settled text

- **WHEN** the user types several characters in quick succession
- **THEN** the field updates on every keystroke but the company request is issued only for the value that has settled for the debounce interval

#### Scenario: Empty search sends no q

- **WHEN** the search field is empty
- **THEN** the request carries no `q` parameter and the unfiltered catalog is listed

#### Scenario: Clearing the search restores the full catalog

- **WHEN** the user clears a non-empty search field
- **THEN** the list returns to the unfiltered catalog starting from the first page

### Requirement: Company ordering

The directory SHALL present companies in the backend's own order (most open roles first) and SHALL offer no sort control. It SHALL NOT send a `sort` parameter, so a change to the server's default ordering reaches this client rather than being pinned by an explicit value.

#### Scenario: No sort is requested

- **WHEN** the directory requests any page, searched or not
- **THEN** the request carries no `sort` parameter

#### Scenario: No sort control is offered

- **WHEN** the directory renders
- **THEN** the screen presents no control for changing the order

### Requirement: Company card content

Each row SHALL render the company's logo, name, open-role count, and — only when the API supplies them — its rating, tagline, first industry and HQ country. A field the API omits or returns as null SHALL render nothing rather than an empty or placeholder element.

#### Scenario: A fully populated company

- **WHEN** a company has a tagline, industries, an HQ country and a rating
- **THEN** the card shows the logo, name, the rating to one decimal place, the open-role count, the tagline, the first industry, and the HQ country as an uppercase code

#### Scenario: A company with no rating yet

- **WHEN** a company's `feedback_rating_avg` is null
- **THEN** the card omits the rating entirely and still shows the open-role count

#### Scenario: A sparse company

- **WHEN** a company has no tagline, no industries and no HQ country
- **THEN** the card renders only the logo, name and open-role count, with no empty rows

#### Scenario: Open-role count is singular for one role

- **WHEN** a company has exactly one open role
- **THEN** the count reads "1 job" rather than "1 jobs"

### Requirement: Opening a company from the directory

Tapping a company card SHALL navigate to that company's existing detail screen at `companies/<slug>`.

#### Scenario: Tapping a card

- **WHEN** the user taps a company card
- **THEN** the app navigates to `/companies/<slug>` for that company

### Requirement: Directory states

The directory SHALL render distinct loading, error and empty states around the list, consistent with the job feed's states. The error state SHALL offer a retry, and the empty state SHALL offer a way to clear a search when one is active.

#### Scenario: Loading the first page

- **WHEN** the first page is in flight and nothing is loaded yet
- **THEN** a loading indicator is shown in place of the list, with the search field still visible and usable

#### Scenario: The request fails

- **WHEN** the company request fails and no companies are loaded
- **THEN** an error message and a retry affordance are shown, and tapping retry refetches

#### Scenario: A search matches nothing

- **WHEN** a search returns zero companies
- **THEN** an empty-state message is shown together with an affordance that clears the search

#### Scenario: The catalog itself is empty

- **WHEN** an unfiltered listing returns zero companies
- **THEN** an empty-state message is shown without a clear-search affordance

### Requirement: Directory refresh

The directory SHALL support pull-to-refresh, refetching from the first page under the current search.

#### Scenario: Pull to refresh

- **WHEN** the user pulls the list down
- **THEN** the current search is refetched from the first page and the refreshing indicator is shown while in flight
