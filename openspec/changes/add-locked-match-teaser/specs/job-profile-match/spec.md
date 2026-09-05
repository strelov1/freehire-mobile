## ADDED Requirements

### Requirement: Deterministic locked-state teaser figures

The teaser figures SHALL be derived deterministically from the job's public slug, so the same job
yields the same teaser on every render and in every surface that shows it. It SHALL be built from
the job's own skills — never a hardcoded list — and MUST NOT be presented as a computed match. It
SHALL report a coverage percent between 60 and 90 inclusive, a matched count consistent with that
percent over the job's real skill count, and a have/missing split marking at least one skill as held
and at least one as missing. A job carrying fewer than two skills SHALL yield no teaser.

#### Scenario: The same job renders the same teaser

- **WHEN** the teaser is derived twice for one job slug
- **THEN** both derivations yield an identical percent and an identical have/missing split

#### Scenario: The percent stays inside the teaser band

- **WHEN** the teaser is derived for any job slug
- **THEN** the percent is at least 60 and at most 90

#### Scenario: The matched count agrees with the percent

- **WHEN** the teaser reports a percent for a job with a known skill count
- **THEN** the matched count is that percent of the skill count, rounded, so the "N of M skills"
  label cannot contradict the percentage beside it

#### Scenario: Both tones are present

- **WHEN** the teaser is derived for any job it applies to
- **THEN** at least one skill reads as held and at least one reads as missing

#### Scenario: A job with fewer than two skills has no teaser

- **WHEN** the teaser is derived for a job with one skill, or none
- **THEN** it yields nothing, and the surface falls back to what it shows without one

### Requirement: The locked states show the teaser above their call-to-action

In the `guest` and `no-profile` states the block SHALL render the blurred teaser above its existing
call-to-action, and SHALL still issue no match request. Where the job yields no teaser, the
call-to-action SHALL stand alone.

#### Scenario: A signed-out viewer sees the teaser

- **WHEN** an unauthenticated viewer opens a job with two or more skills
- **THEN** the block shows the blurred percent, bar and tinted chips above a "Sign in" action, and
  issues no match request

#### Scenario: A viewer with no profile skills sees the same teaser

- **WHEN** a signed-in viewer whose profile has no skills opens a job with two or more skills
- **THEN** the block shows the same teaser above its "Add skills" action

#### Scenario: A single-skill job shows the call-to-action alone

- **WHEN** a locked viewer opens a job carrying exactly one skill
- **THEN** the block shows its call-to-action without a teaser

### Requirement: The teaser is not announced as a score

The teaser SHALL be hidden from assistive technology, and a screen reader MUST NOT be given its
fabricated percentage as if it were the viewer's own match. In its place the surface SHALL expose a
text alternative naming what signing in, or adding skills, would show.

#### Scenario: A screen reader is offered the invitation, not the number

- **WHEN** a surface renders the teaser
- **THEN** the teaser's figures are hidden from assistive technology and an invitation is exposed
  instead
