## ADDED Requirements

### Requirement: Profile screen route
The system SHALL expose the signed-in user's account/profile modal at the
route `/profile` (replacing the prior `/account` route), reachable from the
feed's account icon.

#### Scenario: Signed-in user opens the profile screen
- **WHEN** a signed-in user taps the account icon on the feed
- **THEN** the app navigates to `/profile` and shows the profile modal

### Requirement: Saved profile display
When the signed-in user has a saved profile, the profile screen SHALL
display its specializations and skills as labelled chips, and a location
summary derived from `location_preferences`.

#### Scenario: Profile with specializations and skills
- **WHEN** the signed-in user's saved profile has one or more
  `specializations` and one or more `skills`
- **THEN** the screen shows a chip per specialization (labelled via the same
  category label map the Filters screen uses) and a chip per skill (raw
  token)

#### Scenario: Profile with location preferences
- **WHEN** the signed-in user's saved profile has a non-null
  `location_preferences`
- **THEN** the screen shows a summary line for each non-empty part present
  (work modes, remote reach, base, relocation targets — only shown when
  `relocation.open` is true), and omits a part entirely when it has no data

#### Scenario: Profile with no location preferences
- **WHEN** the signed-in user's saved profile has `location_preferences:
  null`
- **THEN** the screen shows the specializations/skills chips without a
  location summary section

### Requirement: No-profile empty state
When the signed-in user has no saved profile, the profile screen SHALL show
an empty-state message instead of the chips/location summary, without
erroring.

#### Scenario: Signed-in user with no saved profile
- **WHEN** the signed-in user's saved profile is `null`
- **THEN** the screen shows a message that no profile is saved yet, pointing
  to the web app to set one up

### Requirement: Profile fetch error state
When the saved-profile fetch fails, the profile screen SHALL show a distinct
error message instead of the no-profile empty state, so a failed load is
never presented as "no profile saved".

#### Scenario: Profile fetch fails
- **WHEN** the signed-in user's saved-profile fetch fails
- **THEN** the screen shows an error message distinct from the no-profile
  empty-state copy

### Requirement: Profile data loading state
While the saved profile is loading, the profile screen SHALL show a loading
indicator in place of the chips/location summary/empty state.

#### Scenario: Profile fetch in flight
- **WHEN** the signed-in user's saved profile has not finished loading
- **THEN** the screen shows a loading indicator instead of profile content

### Requirement: No push controls on the profile screen
The profile screen SHALL NOT present a push-notification toggle or a
send-test-notification action.

#### Scenario: Signed-in user views the profile screen
- **WHEN** a signed-in user opens the profile screen, regardless of whether
  push notifications are enabled for their device
- **THEN** no push-notification switch or "Send test notification" control
  is shown anywhere on the screen
