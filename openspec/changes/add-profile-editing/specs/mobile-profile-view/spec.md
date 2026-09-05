## MODIFIED Requirements

### Requirement: No-profile empty state
When the signed-in user has no saved profile, the profile screen SHALL show
an empty-state message instead of the chips/location summary, without
erroring, and SHALL offer to create one in the app rather than pointing at
the web app.

#### Scenario: Signed-in user with no saved profile
- **WHEN** the signed-in user's saved profile is `null`
- **THEN** the screen shows a message that no profile is saved yet, with an
  action that opens the profile editor

## ADDED Requirements

### Requirement: The saved profile can be edited from the profile screen

The profile screen SHALL offer an action that opens the profile editor for a signed-in user,
whether or not they already have a saved profile.

#### Scenario: A user with a profile edits it

- **WHEN** a signed-in user with a saved profile taps the edit action on the profile screen
- **THEN** the profile editor opens, seeded with their saved specializations and skills

#### Scenario: The edited profile is shown on return

- **WHEN** the user saves a change in the editor and returns to the profile screen
- **THEN** the screen shows the saved values, not the ones read before the edit
