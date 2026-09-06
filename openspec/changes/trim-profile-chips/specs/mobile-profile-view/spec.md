## MODIFIED Requirements

### Requirement: Saved profile display
When the signed-in user has a saved profile, the profile screen SHALL state how many
specializations and skills it holds, and a location summary derived from
`location_preferences`. It SHALL NOT list the specializations and skills themselves: a
filled-in profile runs to dozens of skills, and they are one tap away in the editor, where
they can be changed rather than only read.

#### Scenario: Profile with specializations and skills
- **WHEN** the signed-in user's saved profile has one or more `specializations` and one or
  more `skills`
- **THEN** the screen states both counts beside the action that opens the editor, and shows
  no chip per value

#### Scenario: Profile with location preferences
- **WHEN** the signed-in user's saved profile has a non-null `location_preferences`
- **THEN** the screen shows a summary line for each non-empty part present (work modes,
  remote reach, base, relocation targets — only shown when `relocation.open` is true), and
  omits a part entirely when it has no data

#### Scenario: Profile with no location preferences
- **WHEN** the signed-in user's saved profile has `location_preferences: null`
- **THEN** the screen shows the counts without a location summary section
