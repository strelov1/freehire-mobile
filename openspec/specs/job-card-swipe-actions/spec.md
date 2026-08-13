# job-card-swipe-actions

## Purpose

Swipe gestures on the mobile feed's job cards — swipe left to save a job,
swipe right to hide (dismiss) it — including their reveal/auto-commit
interaction and persistence across sessions. TBD: expand as the capability
grows.

## Requirements

### Requirement: Swipe left saves a job
Swiping a feed card to the left SHALL toggle the job's saved state, using the
same save/unsave semantics as the existing bookmark control. The action SHALL
be reachable either by dragging past the reveal threshold (auto-commit) or by
tapping the revealed save action.

#### Scenario: Signed-in user swipes left on an unsaved job
- **WHEN** a signed-in user swipes a card left past the commit threshold
- **THEN** the job is marked saved (optimistically, then confirmed against the
  backend) and appears in the user's saved jobs

#### Scenario: Signed-in user swipes left on an already-saved job
- **WHEN** a signed-in user swipes left on a card for a job they've already
  saved
- **THEN** the job's saved mark is cleared (toggle behavior, matching the
  existing bookmark control)

#### Scenario: Signed-out user swipes left
- **WHEN** a signed-out user swipes a card left past the commit threshold
- **THEN** the app routes to the sign-in screen instead of saving, matching the
  existing bookmark control's signed-out behavior

### Requirement: Swipe right hides a job
Swiping a feed card to the right SHALL dismiss (hide) the job: mark it hidden
via the backend's dismiss endpoint and remove it from the feed's rendered list.
The action SHALL be reachable either by dragging past the reveal threshold
(auto-commit) or by tapping the revealed hide action. Dismissal is optimistic:
the card is removed from the feed immediately, and a failed request restores it.

#### Scenario: Signed-in user swipes right to hide a job
- **WHEN** a signed-in user swipes a card right past the commit threshold
- **THEN** the job is marked dismissed on the backend and the card is removed
  from the feed's rendered list

#### Scenario: Dismiss request fails
- **WHEN** a signed-in user swipes right and the backend dismiss call fails
- **THEN** the card is restored to the feed's rendered list

#### Scenario: Signed-out user swipes right
- **WHEN** a signed-out user swipes a card right past the commit threshold
- **THEN** the app routes to the sign-in screen instead of hiding, and the card
  remains in the feed

### Requirement: Dismissed jobs stay out of the feed across sessions
A job the signed-in user has dismissed SHALL NOT reappear in that user's feed on
a subsequent load, until the dismissal is cleared server-side.

#### Scenario: Reopening the app after hiding a job
- **WHEN** a signed-in user dismissed a job in a previous session and reopens
  the feed
- **THEN** that job does not appear in the rendered feed
