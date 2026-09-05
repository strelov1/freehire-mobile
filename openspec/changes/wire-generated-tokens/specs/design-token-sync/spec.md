## ADDED Requirements

### Requirement: The generated tokens are what the app reads

The app's colour palette SHALL be derived from the generated token file, and the app SHALL NOT keep
a second hand-written set of the same values. A colour is added to the app by adding it to the
design-system source and re-running the sync.

#### Scenario: Every palette colour comes from the generated file

- **WHEN** a component reads a colour through the app's palette
- **THEN** the value it receives is the one in the generated token file for that theme

#### Scenario: A colour with no token is derived, not invented

- **WHEN** the app needs a colour the design system does not define — a muted destructive fill, which
  the web writes inline as an opacity modifier React Native has no equivalent of
- **THEN** it is computed from a generated colour rather than written as a literal

### Requirement: The scales keep semantic names over the generated values

The spacing and radius scales SHALL expose semantic names — `xs` through `xl` — whose values are read
from the generated scales, so a screen names its rhythm without restating it.

#### Scenario: A spacing name resolves to the generated step

- **WHEN** a screen uses the `lg` spacing name
- **THEN** it receives the generated 4-step value

#### Scenario: A radius idiom the scale cannot express stays local

- **WHEN** a chip asks to be fully round
- **THEN** it uses a local `pill` value, since a scale of fixed radii has no token for it

### Requirement: A missing scale step fails loudly

Reading a scale step the generated file does not carry SHALL raise an error naming the token and the
sync command, rather than yielding an undefined value.

#### Scenario: A renamed or dropped token stops the app

- **WHEN** the generated spacing scale no longer carries a step the app names
- **THEN** an error naming that step and the sync command is raised, rather than the value spreading
  through the layout as a missing margin
