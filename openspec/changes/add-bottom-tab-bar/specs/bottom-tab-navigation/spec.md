## ADDED Requirements

### Requirement: Four-tab bottom navigation
The app SHALL present a bottom tab bar with exactly four tabs — Jobs,
Companies, Notifications, Profile — replacing the feed header's
notifications bell and profile/sign-in avatar.

#### Scenario: Tabs are present
- **WHEN** the app is launched
- **THEN** a bottom tab bar with Jobs, Companies, Notifications, and
  Profile tabs is visible
- **AND** the feed's header no longer shows a notifications bell or a
  profile avatar

#### Scenario: Jobs tab shows the feed
- **WHEN** the Jobs tab is active
- **THEN** the existing job feed (search bar, region shortcut, filters
  button, job list) renders exactly as before this change

### Requirement: Companies tab is a placeholder
The Companies tab SHALL render a static "coming soon" screen with no data
fetching, since no company list/search API exists yet.

#### Scenario: Opening the Companies tab
- **WHEN** the user taps the Companies tab
- **THEN** a static screen indicating the feature is not yet available is
  shown, with no network request made

### Requirement: Notifications tab renders the list inline
The Notifications tab SHALL show the notification list directly as tab
content, not as a modal, with the unread count shown as a badge on the tab
icon instead of on a header bell.

#### Scenario: Unread notifications badge
- **WHEN** the signed-in user has unread notifications
- **THEN** the Notifications tab icon shows a badge with the unread count

#### Scenario: Opening the Notifications tab
- **WHEN** the user taps the Notifications tab
- **THEN** the notification list renders inline within the tab (no modal
  is presented, no dismiss button is shown)

### Requirement: Profile tab handles signed-out state inline
The Profile tab SHALL show the signed-in profile screen when a user is
authenticated, and an inline sign-in prompt when not — never redirecting
automatically to the auth modal on tab selection.

#### Scenario: Signed-in user opens Profile
- **WHEN** a signed-in user taps the Profile tab
- **THEN** their profile screen renders inline within the tab

#### Scenario: Signed-out user opens Profile
- **WHEN** a signed-out user taps the Profile tab
- **THEN** an inline screen with a "Sign in" action is shown within the tab
- **AND** tapping "Sign in" opens the existing auth modal

### Requirement: Tab bar auto-hides on scroll and reappears on scroll-up
While viewing the Jobs feed, the tab bar SHALL hide when the user scrolls
down past a small threshold near the top, and SHALL reappear immediately
on any upward scroll.

#### Scenario: Scrolling down hides the bar
- **WHEN** the user scrolls the job feed down past the top threshold
- **THEN** the tab bar animates out of view

#### Scenario: Scrolling up shows the bar
- **WHEN** the tab bar is hidden and the user scrolls the feed upward
- **THEN** the tab bar animates back into view

#### Scenario: Near the top, the bar stays visible
- **WHEN** the feed is scrolled only a small amount from the top (within
  the threshold)
- **THEN** the tab bar remains visible regardless of scroll direction
