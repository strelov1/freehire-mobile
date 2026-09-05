## ADDED Requirements

### Requirement: The match lists the job's hard requirements beside its skill coverage

When the match response carries hard-constraint blockers, the block SHALL render a requirements
section listing each one's reason: the unmet constraints first, ordered hardest first, then the met
ones marked as satisfied.

#### Scenario: Unmet and met constraints are both listed

- **WHEN** the match carries an unmet work-authorization constraint and a met experience constraint
- **THEN** the block lists the work-authorization reason first, as unmet, and the experience reason
  after it, as satisfied

#### Scenario: The hardest unmet constraint comes first

- **WHEN** two constraints are unmet and one caps the score lower than the other
- **THEN** the lower-capping one is listed first

#### Scenario: A caller with no structured résumé sees no section

- **WHEN** the match response carries an empty blockers array
- **THEN** no requirements section is rendered, and no heading states requirements that were not
  assessed

### Requirement: An unmet requirement is toned by how hard it is

An unmet constraint SHALL be rendered in a tone reflecting its severity — a hard constraint reading
as blocking, a medium one as a caution, and a soft one as a quiet note — so that a work permit the
candidate lacks does not read the same as a preference they do not meet.

#### Scenario: A hard constraint reads as blocking

- **WHEN** an unmet constraint has hard severity
- **THEN** it is rendered in the blocking tone

#### Scenario: A soft constraint does not read as blocking

- **WHEN** an unmet constraint has soft severity
- **THEN** it is rendered in a quieter tone than a hard one

### Requirement: Requirements are advisory and never act on the job

The requirements section MUST NOT hide, filter, downrank, disable or visually diminish the job, and
MUST NOT change the coverage percentage, the bar, or the skill groups.

#### Scenario: An unmet hard constraint leaves the job fully readable

- **WHEN** a job carries an unmet hard constraint
- **THEN** the job's title, salary, description and its apply action are shown exactly as they are
  for a job with none

#### Scenario: Coverage ignores the blockers

- **WHEN** the same match is rendered with and without blockers
- **THEN** the coverage percentage, the bar segments and the three skill groups are identical
