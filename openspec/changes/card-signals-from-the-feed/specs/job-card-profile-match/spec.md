## ADDED Requirements

### Requirement: The card shows the view count it can be sorted by

A feed card SHALL show the job's public view count beside its timestamp when that count is above
zero, abbreviated for width, with the exact figure exposed to assistive technology.

#### Scenario: A viewed job states its count

- **WHEN** a job carries 156 views
- **THEN** the card shows the abbreviated count beside the timestamp, and assistive technology is
  offered "156 views"

#### Scenario: An unviewed job says nothing

- **WHEN** a job carries no views
- **THEN** the card shows no count, since "0 views" reads as a dead posting rather than a new one

### Requirement: The card carries the trust verdict and what is fresh about a posting

A feed card SHALL render the reality badge and the freshness badges above its facet chips, in that
order — a warning that a posting may not be real outranks a note that it is new.

#### Scenario: A long-open posting is marked as such

- **WHEN** the served reality signal classifies a job as stale at 75 days
- **THEN** the card shows that verdict, as the job's own screen does

#### Scenario: A recent posting is marked new

- **WHEN** a job's reality signal reads fresh and it was posted within the last week
- **THEN** the card shows "New"

#### Scenario: A card that cannot verify freshness claims nothing

- **WHEN** a job carries no reality signal at all
- **THEN** the card shows no freshness badge, because without the signal a date rewritten on every
  crawl cannot be told from a genuinely new posting

#### Scenario: A closed posting is never urgent

- **WHEN** a job has closed
- **THEN** the card shows no freshness badge, whatever its date says
