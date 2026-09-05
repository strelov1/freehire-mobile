## ADDED Requirements

### Requirement: The job-detail screen shows a server-computed profile match

The job-detail screen SHALL render a profile-match block that, for a signed-in viewer holding
profile skills, reads `GET /api/v1/jobs/:slug/match` and shows the coverage percent, a two-segment
bar, and the job's skills grouped as **You have** (exact), **Close** (adjacent) and **Missing**. The
classification SHALL be the server's; the client SHALL NOT approximate the adjacency dictionary,
which it does not hold.

#### Scenario: A viewer with profile skills sees the three groups

- **WHEN** a signed-in viewer whose profile skills are `[react, typescript, gcp]` opens a job whose
  skills are `[react, typescript, graphql, nodejs, aws]`
- **THEN** the block shows `50%`, `react` and `typescript` under You have, `aws` under Close, and
  `graphql` and `nodejs` under Missing

#### Scenario: A close skill names what it matched through

- **WHEN** a skill is classified adjacent with `via: "gcp"`
- **THEN** its chip states that the viewer has `gcp`

#### Scenario: An empty group is not drawn

- **WHEN** the match reports no adjacent skills
- **THEN** the Close group and its heading are absent, rather than shown empty

### Requirement: Only a state that can produce a real match calls the endpoint

The block SHALL resolve its state from what the screen already knows — the job's skills, whether a
viewer is signed in, and whether their profile has loaded and carries skills — as exactly one of
`no-skills`, `guest`, `loading`, `no-profile` or `ready`. It SHALL issue the match request in the
`ready` state only.

#### Scenario: A job with no skills

- **WHEN** the open job's `skills` list is empty
- **THEN** the block states there is not enough data to compare and issues no request

#### Scenario: A signed-out viewer

- **WHEN** nobody is signed in
- **THEN** the block invites signing in and issues no request

#### Scenario: A signed-in viewer whose profile is still loading

- **WHEN** the viewer is signed in and their profile has not settled
- **THEN** the block shows a loading state, issues no request, and does not show a
  call-to-action it may be about to replace

#### Scenario: A signed-in viewer with no profile skills

- **WHEN** the viewer is signed in and their profile carries no skills
- **THEN** the block states that adding skills is what produces a match, and issues no request

#### Scenario: The job's skills decide, not the screen's fallback

- **WHEN** a job's own `skills` list is empty but its `enrichment.skills` is not
- **THEN** the state is `no-skills` and no request is issued, because the server matches on the
  job's dictionary skills alone

### Requirement: The match is cached as private, per-user data

The match SHALL be cached under a key carrying the signed-in user's id, so that clearing private
user data on an identity change removes it.

#### Scenario: A match does not survive a change of who is signed in

- **WHEN** one user views a job's match and a different user then signs in on the same device
- **THEN** the first user's match is not shown to the second

### Requirement: The block replaces the job's skill row only when it renders the groups

The job-detail screen SHALL show its flat skill row except when the match block is rendering its
three groups, so that the same skills are never listed twice in succession, and are never absent
altogether.

#### Scenario: A rendered match takes the row's place

- **WHEN** the block renders the grouped chips for a real match
- **THEN** the screen's flat skill row is not shown

#### Scenario: A failed match gives the row back

- **WHEN** the match request fails
- **THEN** the block reports quietly that the match is unavailable, and the flat skill row is shown

#### Scenario: A locked viewer keeps the row

- **WHEN** the viewer is signed out, has no profile skills, or the block is still loading
- **THEN** the flat skill row is shown

### Requirement: An empty comparison is reported as no data, not as a zero score

When the match response reports `total: 0`, the block SHALL render its not-enough-data state and
MUST NOT present `0%` as the viewer's coverage.

#### Scenario: The server finds nothing to compare

- **WHEN** the match response carries `total: 0`
- **THEN** the block states there is not enough data and shows no percentage or bar

### Requirement: The bar weighs an adjacent skill at half an exact one

The coverage bar SHALL be drawn as two segments — a full-weight segment sized `exact_count / total`
and a half-weight segment sized `0.5 × adjacent_count / total`, each as a percentage of the track —
so that the drawn fill agrees with the reported `coverage_percent`.

#### Scenario: Segment widths follow the counts

- **WHEN** a job carries 5 skills with 2 exact and 1 adjacent
- **THEN** the bar's exact segment covers 40% of the track and its adjacent segment 10%, beside a
  reported `50%`

#### Scenario: A job with no skills draws no fill

- **WHEN** `total` is 0
- **THEN** both segments are zero-width and no division by zero occurs

### Requirement: The match is announced as one figure, not as decoration

The coverage bar SHALL carry a text alternative stating the percentage and the counts it
represents, and its individual segments SHALL be hidden from assistive technology.

#### Scenario: A screen reader is given the figure

- **WHEN** the bar renders a match of 67% over 2 of 3 skills
- **THEN** assistive technology is offered that percentage and count as a single label, not two
  unlabelled views
