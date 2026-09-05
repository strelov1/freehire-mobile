## ADDED Requirements

### Requirement: A signed-in user can edit their profile in the app

The app SHALL provide a screen that edits the signed-in user's specializations, held skills and
avoided skills, and saves them through `PUT /api/v1/me/profile`. It SHALL be reachable by a user who
has a saved profile and by one who has none.

#### Scenario: A user with no profile creates one

- **WHEN** a signed-in user with no saved profile opens the editor, picks a specialization and a
  skill, and saves
- **THEN** the profile is created and the screen reports it saved

#### Scenario: A user with a profile changes it

- **WHEN** a signed-in user with a saved profile adds a skill and saves
- **THEN** the saved profile carries the skills it had plus the added one

#### Scenario: A signed-out visitor is sent to sign in

- **WHEN** a signed-out visitor reaches the editor
- **THEN** they are offered sign-in and no profile request is made

### Requirement: A save preserves every field the screen does not edit

Because the endpoint replaces the whole profile row, a save SHALL send the values the screen does
not edit — the user's seniorities and location preferences — exactly as they were last read, so
editing skills cannot discard them.

#### Scenario: Seniorities survive a skill edit

- **WHEN** a user whose profile carries seniorities edits only their skills and saves
- **THEN** the saved profile still carries those seniorities

#### Scenario: Location preferences survive a skill edit

- **WHEN** a user whose profile carries location preferences edits only their skills and saves
- **THEN** the saved profile still carries those location preferences

#### Scenario: A save is not offered before the profile has been read

- **WHEN** the editor is opened and the profile read has not settled
- **THEN** saving is unavailable, because a write built from an unread profile could not preserve
  what it did not read

### Requirement: The editor refuses a save the server would reject

The editor SHALL require at least one specialization and at least one skill, and SHALL allow at most
ten specializations, disabling the save action and naming the unmet rule rather than issuing a
request that would return 400.

#### Scenario: No specialization chosen

- **WHEN** the user has chosen skills but no specialization
- **THEN** saving is unavailable and the screen states that at least one specialization is required

#### Scenario: No skill chosen

- **WHEN** the user has chosen a specialization but no skill
- **THEN** saving is unavailable and the screen states that at least one skill is required

#### Scenario: Too many specializations

- **WHEN** the user has chosen more than ten specializations
- **THEN** saving is unavailable and the screen states the limit

### Requirement: A skill is either held or avoided, never both

Each skill option SHALL cycle between three states — neither, held, avoided — so that one skill
cannot be put in both lists from this screen.

#### Scenario: Cycling a skill through its three states

- **WHEN** the user taps an unselected skill three times
- **THEN** it reads as held, then as avoided, then as neither

#### Scenario: Choosing a held skill as avoided drops it from the held set

- **WHEN** the user marks a currently held skill as avoided and saves
- **THEN** the saved profile carries that skill among its avoided skills and not among its skills

### Requirement: Saving the profile invalidates every job match

A successful save SHALL invalidate the cached profile and every cached per-job match for that user,
because each match is a statement about the skills that were just changed.

#### Scenario: A job's match is recomputed after a skill is added

- **WHEN** a user views a job's match, adds one of its missing skills in the editor, saves, and
  returns to the job
- **THEN** the match shown is recomputed rather than the one cached before the save

### Requirement: A failed save leaves the editor's state intact

When the save request fails, the editor SHALL keep the user's chosen values, state that the save
failed, and offer to try again. It MUST NOT report the profile as saved or discard the edit.

#### Scenario: The save request fails

- **WHEN** the profile save returns an error
- **THEN** the chosen specializations and skills are still on screen, an error is shown, and saving
  can be retried
