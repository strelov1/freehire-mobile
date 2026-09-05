## ADDED Requirements

### Requirement: Claiming a missing skill from the match block

In the real-match state, every chip in the Missing and Close groups SHALL be an activatable control
that discloses a claim row naming that skill and offering to add it to the caller's profile. Chips
in the You have group SHALL remain inert: this affordance adds skills and never removes them. The
affordance SHALL be absent from the guest, no-profile, no-skills and loading states, whose chips are
a fabricated teaser rather than a match.

#### Scenario: A missing chip discloses the claim row

- **WHEN** a signed-in viewer with a profile presses a chip in the Missing group
- **THEN** a row naming that skill appears, offering to add it to the profile

#### Scenario: A close chip offers the skill itself, not its neighbour

- **WHEN** the viewer presses a Close chip for a skill held only through a neighbour
- **THEN** the row offers to add that skill, not the neighbour it was matched through

#### Scenario: Only one row is open at a time

- **WHEN** a row is open for one skill and the viewer presses a different Missing or Close chip
- **THEN** the row moves to the newly pressed skill; pressing the same chip again closes it

#### Scenario: Held chips offer nothing

- **WHEN** the viewer presses a chip in the You have group
- **THEN** no row opens and the profile does not change

#### Scenario: A locked viewer cannot claim

- **WHEN** an unauthenticated viewer, or one with no profile skills, sees the blurred teaser
- **THEN** its chips are not activatable and no claim row is reachable

### Requirement: A claimed skill is reclassified before the write settles

Confirming a claim SHALL move the skill into the You have group and recompute the coverage
client-side without waiting for the profile write, using the server's weighting — an exact match
weighs 1, an adjacent one a half. Once the write succeeds the block SHALL refetch the match and
render the server's classification in place of the optimistic one.

#### Scenario: The chip moves and the percentage rises immediately

- **WHEN** the viewer confirms a claim for a Missing skill of a job carrying 4 skills, 1 of which
  was already exact
- **THEN** the skill appears in You have, the counts read 2 of 4, and the coverage reads 50% before
  the profile request settles

#### Scenario: A claimed Close skill stops being half-weighted

- **WHEN** the viewer claims a skill that was classified adjacent
- **THEN** it leaves the Close group, the adjacent count falls by one, the exact count rises by one,
  and the coverage rises by the half weight the adjacency was contributing

#### Scenario: The server's classification replaces the optimistic one

- **WHEN** the profile write succeeds
- **THEN** the block refetches the match, so a skill the claim newly made adjacent is shown as Close
  rather than left in Missing

#### Scenario: A failed refetch keeps the optimistic view

- **WHEN** the profile write succeeds but the follow-up match request fails
- **THEN** the block keeps the optimistic classification and does not revert the claim, which the
  server has already accepted

### Requirement: A claim is confirmed and reversible

After a successful claim the block SHALL show a confirmation naming the skill and offering undo. The
confirmation SHALL name the most recent write; a further one replaces it. Undo SHALL subtract only
that skill — never restore a whole earlier profile, which would roll back any claim made after it. A
claimed skill SHALL also leave the profile's avoided set, so the profile cannot both claim and avoid
one skill.

#### Scenario: The confirmation offers undo

- **WHEN** a claim is written successfully
- **THEN** the block states that the skill was added to the profile, with an undo action

#### Scenario: A second claim takes over the confirmation

- **WHEN** the viewer claims one skill and then another
- **THEN** the confirmation names the second, and undoing it leaves the first in the profile

#### Scenario: Claiming an avoided skill resolves the contradiction

- **WHEN** the viewer claims a skill their profile currently avoids
- **THEN** the saved profile carries that skill among its skills and no longer among its avoided
  skills

### Requirement: Avoiding a skill from the match block

The claim row SHALL offer, beside the action that claims the skill, one that records it as a skill
to avoid — written to the profile's avoided set. Avoiding SHALL remove the skill from the profile's
held skills, mirroring the rule that claiming removes it from the avoided set.

#### Scenario: The row offers both answers

- **WHEN** the viewer presses a Missing or Close chip
- **THEN** the row names that skill and offers both to add it and to avoid it

#### Scenario: Avoiding writes the avoided set

- **WHEN** the viewer avoids a skill
- **THEN** the saved profile carries it among its avoided skills and not among its skills

### Requirement: The match does not move when a skill is avoided

Avoiding a skill SHALL leave the coverage, the bar and the three groups exactly as they were, and
SHALL NOT refetch the match. The server computes coverage from held skills alone, so an avoided
skill is still one the candidate does not have.

#### Scenario: Coverage is unchanged

- **WHEN** the viewer avoids a skill from the Missing group
- **THEN** the coverage and counts read exactly what they did, and the skill stays in Missing

#### Scenario: No match request is issued

- **WHEN** an avoid is written successfully
- **THEN** the block does not refetch the match

### Requirement: An avoided skill is marked wherever it appears

A chip naming a skill in the viewer's avoided set SHALL render as avoided — visually distinct from
an ordinary missing chip and marked as such for assistive technology. The marking SHALL be derived
from the profile the block already holds, so it appears on every job asking for that skill with no
additional request.

#### Scenario: The mark survives to another job

- **WHEN** the viewer avoids a skill on one job and opens another job that also asks for it
- **THEN** that job's chip renders as avoided, with no further request

#### Scenario: The mark is announced, not merely drawn

- **WHEN** a chip renders as avoided
- **THEN** its accessible name says the skill is one the viewer avoids

### Requirement: An avoided skill can be un-avoided where it was marked

Pressing an avoided chip SHALL open the row offering to claim the skill or to stop avoiding it.
Stopping SHALL remove it from the avoided set and leave the held set untouched.

#### Scenario: The mark is lifted

- **WHEN** the viewer presses an avoided chip and chooses to stop avoiding it
- **THEN** the skill leaves the avoided set and the chip renders as an ordinary missing skill

#### Scenario: An avoided skill can still be claimed

- **WHEN** the viewer presses an avoided chip and claims it instead
- **THEN** the skill is added to the held skills, removed from the avoided ones, and the chip moves
  to You have

### Requirement: Concurrent writes cannot drop each other

Because the profile endpoint replaces the whole row, writes from the match block SHALL be serialised
so that each is built from the result of the previous one.

#### Scenario: Two rapid claims both persist

- **WHEN** the viewer confirms a claim for one skill and, before it settles, confirms one for
  another
- **THEN** the profile ends up holding both, and neither write is sent with a skill list that
  predates the other

### Requirement: A failed write is rolled back and reported

When a claim's write fails, the block SHALL return the skill to the group it came from, restore the
previous counts and coverage, and state that it could not be added. It MUST NOT show a confirmation
for a write that did not land. A failed avoid SHALL leave the profile and the chip as they were and
state the failure.

#### Scenario: A failed claim restores the chip

- **WHEN** the profile write for a claimed skill fails
- **THEN** the skill reappears in the group it was claimed from, the coverage returns to its
  previous value, and an error is shown

#### Scenario: A failed avoid changes nothing

- **WHEN** the profile write for an avoided skill fails
- **THEN** the chip renders as it did before, no confirmation is shown, and an error is shown
