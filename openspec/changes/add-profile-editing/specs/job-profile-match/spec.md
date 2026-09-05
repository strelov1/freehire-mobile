## ADDED Requirements

### Requirement: The no-profile state offers to build the profile it is waiting on

In the `no-profile` state the match block SHALL offer an action that opens the profile editor. The
state was specified without one because the screen did not exist; it does now, and a viewer told
that skills produce a match SHALL be able to add them from where they were told.

#### Scenario: A viewer with no profile skills is offered the editor

- **WHEN** a signed-in viewer whose profile carries no skills opens a job with skills
- **THEN** the block states that adding skills produces a match and offers an action that opens the
  profile editor

#### Scenario: The match appears once skills are saved

- **WHEN** that viewer saves skills in the editor and returns to the job
- **THEN** the block shows the computed match rather than the no-profile state

#### Scenario: The locked states below it are unchanged

- **WHEN** the viewer is signed out, or the job carries no skills
- **THEN** the block behaves as before and still issues no match request
