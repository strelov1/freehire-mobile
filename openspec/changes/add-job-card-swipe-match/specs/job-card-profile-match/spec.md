## ADDED Requirements

### Requirement: Client-side skill match computation
The system SHALL compute, for a signed-in user with a loaded profile, the exact
case-insensitive overlap between a job's `skills` and the user's profile
`skills`, expressed as `{ total, matched, percent }` where `total` is the job's
skill count, `matched` is the count of the job's skills present (case-
insensitively) in the user's profile skills, and `percent` is
`round(matched / total * 100)`.

#### Scenario: Job skills overlap the profile
- **WHEN** a job has skills `["React", "Go", "SQL"]` and the user's profile
  skills include `["react", "sql"]`
- **THEN** the computed match is `{ total: 3, matched: 2, percent: 67 }`

#### Scenario: Job has no skills
- **WHEN** a job has an empty `skills` list
- **THEN** the computed match is `{ total: 0, matched: 0, percent: 0 }`, not a
  division-by-zero error

### Requirement: Skill chip tinting reflects profile overlap
On the feed card, each skill chip SHALL render in a "held" tint when the
signed-in user's profile skills include that skill (case-insensitively) and a
"missing" tint when a real match has been computed but the skill is absent from
the profile. When no real match can be computed (signed out, profile not
loaded, or profile has no skills), every chip SHALL render in the existing
neutral tint.

#### Scenario: Signed-in user with partial skill overlap
- **WHEN** the signed-in viewer's profile has skills `["react", "sql"]` and the
  card shows job skills `["React", "Go", "SQL"]`
- **THEN** the "React" and "SQL" chips render in the held tint and the "Go" chip
  renders in the missing tint

#### Scenario: Signed-out viewer
- **WHEN** no user is signed in
- **THEN** every skill chip on every card renders in the existing neutral tint

#### Scenario: Signed-in viewer with an empty profile skill list
- **WHEN** the signed-in viewer's profile has no skills
- **THEN** every skill chip on every card renders in the existing neutral tint

### Requirement: Match bar rendered only for a real match
Below the skill row, the card SHALL render a two-tone progress bar and a
"`{percent}% · {matched}/{total} skills`" label when, and only when, a real
match was computed for that card (signed in, profile loaded with at least one
skill, and the job has at least one skill). The bar's filled segment SHALL be
sized to `percent` of the track width.

#### Scenario: Real match available
- **WHEN** the signed-in viewer has profile skills and the job has skills
- **THEN** the match bar renders with a fill width proportional to the computed
  `percent` and the label shows the computed `matched`/`total`

#### Scenario: No match available
- **WHEN** the viewer is signed out, or signed in with no profile skills, or the
  job has no skills
- **THEN** the match bar does not render
