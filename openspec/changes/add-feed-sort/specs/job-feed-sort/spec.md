## ADDED Requirements

### Requirement: The feed offers a choice of ordering

The feed SHALL offer the reader a sort control listing Newest, Most viewed and Best match, plus
Relevance whenever the search carries query text. Choosing an ordering SHALL re-run the search
without further confirmation.

#### Scenario: Relevance is offered only with something to rank

- **WHEN** the search box carries text
- **THEN** Relevance is among the offered orderings

#### Scenario: A textless browse does not offer relevance

- **WHEN** the search box is empty
- **THEN** the offered orderings are Newest, Most viewed and Best match

#### Scenario: Choosing an ordering applies it at once

- **WHEN** the reader picks an ordering
- **THEN** the feed re-runs its search in that order, with no separate apply step

### Requirement: The default ordering mirrors the server's

The client SHALL treat the absence of a chosen ordering as the server's own default — relevance
under query text, newest without it — and SHALL serialize that default as no `sort` parameter,
rather than naming a value for it.

#### Scenario: An unchosen ordering sends no sort parameter

- **WHEN** the reader has chosen no ordering
- **THEN** the request carries no `sort` parameter

#### Scenario: Relevance is the absence of a parameter, not a value

- **WHEN** relevance is the ordering in force
- **THEN** the request carries no `sort` parameter, because the endpoint has no wire value for it

### Requirement: Only relevance collapses when the query is cleared

When the query text is cleared, an ordering of relevance SHALL resolve to newest, having nothing
left to rank. Every other chosen ordering SHALL survive the query being cleared.

#### Scenario: Relevance falls back once there is no text

- **WHEN** the reader has relevance in force and clears the search box
- **THEN** the ordering in force becomes newest

#### Scenario: Most viewed survives a cleared query

- **WHEN** the reader has chosen most viewed and clears the search box
- **THEN** most viewed is still in force, since it ranks by a stored figure rather than by the text

### Requirement: Best match is offered without a profile, and explains itself

Best match SHALL be offered to every reader, including one with no profile skills. When it is the
ordering in force and the reader has no skills on file, the feed SHALL say that the ordering has
nothing to rank against and what would give it something.

#### Scenario: A reader with no skills is still offered best match

- **WHEN** a reader with no profile skills opens the sort control
- **THEN** Best match is among the options

#### Scenario: The feed explains an ordering it cannot rank

- **WHEN** best match is in force and the reader has no profile skills
- **THEN** the feed states that adding skills is what the ordering ranks against, rather than
  silently serving a different order

#### Scenario: A reader with skills is told nothing

- **WHEN** best match is in force and the reader has profile skills
- **THEN** no such explanation is shown
