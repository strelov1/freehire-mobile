## ADDED Requirements

### Requirement: Plan row on the profile screen

The profile screen SHALL show the signed-in user's plan and SHALL be the entry point to the
purchase surface.

It is the only place the app states what plan somebody is on, so it states it from the
server's answer rather than from anything cached on the device. A signed-out visitor sees no
plan row: there is no plan without an account, and an empty one would read as "free" rather
than as "nobody is signed in".

#### Scenario: A signed-in user sees their plan

- **WHEN** a signed-in user opens the profile screen
- **THEN** a row shows their plan, and Pro shows when it runs to

#### Scenario: The row opens the purchase surface

- **WHEN** the user taps the plan row
- **THEN** the app navigates to the plan screen

#### Scenario: A signed-out visitor sees no plan row

- **WHEN** nobody is signed in
- **THEN** the profile screen shows no plan row and makes no request for one

#### Scenario: A plan that cannot be read does not break the screen

- **WHEN** the plan request fails
- **THEN** the rest of the profile screen renders as before and the row reports that the plan
  is unavailable rather than showing a wrong one

## REMOVED Requirements

### Requirement: Saved profile display

**Reason**: The section it described could not be acted on from this app. Signed in without a
saved profile it read "No profile saved yet. Set one up at freehire.me/my/profile." — a link in
prose to a page the app cannot open — and signed in WITH one it showed chips that nothing here
can edit. The screen is now identity, plan, policies and account actions, each of which the app
owns.

**Migration**: None for stored data; nothing was written by this surface. Editing a saved
profile stays where it always was, on the web. `ChipRow`, the location summary and the
`useProfile` read went with it rather than remaining as dead weight.

### Requirement: No-profile empty state

**Reason**: The empty state of a section that no longer exists.

**Migration**: None.

### Requirement: Profile fetch error state

**Reason**: The error state of a section that no longer exists. Nothing on this screen fetches
a saved profile now.

**Migration**: None.

### Requirement: Profile data loading state

**Reason**: The loading state of a section that no longer exists.

**Migration**: None.
