## ADDED Requirements

### Requirement: Card-level teaser for locked viewers

A feed card SHALL show the blurred teaser to a viewer in either locked state — not authenticated, or
authenticated without profile skills — where a viewer with profile skills continues to see the real
client-computed coverage. The card's skill chips SHALL take their held/missing tint from the same
teaser that feeds its bar, so the chips and the percentage cannot disagree. The blur SHALL cover the
chips and the coverage strip only, leaving the rest of the card — the salary included — legible.

#### Scenario: A guest sees the blurred teaser

- **WHEN** an unauthenticated viewer sees a card for a job with two or more skills
- **THEN** the card renders the tinted chips and the coverage strip under a blur, and issues no
  per-card match request

#### Scenario: A signed-in viewer without skills sees the same teaser

- **WHEN** an authenticated viewer whose profile has no skills sees such a card
- **THEN** the card renders the same teaser as a guest

#### Scenario: A viewer with a profile still sees the real bar

- **WHEN** an authenticated viewer with profile skills sees such a card
- **THEN** the card renders the client-computed coverage unblurred, tinted by their actual skills

#### Scenario: The salary stays legible under the teaser

- **WHEN** a card showing the teaser also carries a salary
- **THEN** the salary renders unblurred

#### Scenario: A job with one skill keeps the plain card

- **WHEN** a locked viewer sees a card for a job carrying fewer than two skills
- **THEN** the card renders its neutral chips and no coverage strip, as it does today
