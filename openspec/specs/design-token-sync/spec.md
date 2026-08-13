# design-token-sync

## Purpose

Lets the mobile app regenerate its color, spacing, and radius constants from `hire`'s design-system token source on demand, so the two stay in sync instead of drifting apart through hand-editing.

## Requirements

### Requirement: Generate a typed token file from the design-system source
Running the sync script SHALL read `color.tokens.json`, `color-dark.tokens.json`, `spacing.tokens.json`, and `radius.tokens.json` from `../hire/design-system/tokens/` and SHALL write a generated TypeScript file exporting a light color palette, a dark color palette, a spacing scale, and a radius scale, each covering every token present in the corresponding source file.

#### Scenario: Successful sync run
- **WHEN** a developer runs the sync command with `../hire/design-system/tokens/` present and containing valid token files
- **THEN** the generated file is written with a light palette, a dark palette, a spacing scale, and a radius scale, each containing every token key from the corresponding source file

#### Scenario: Generated file is marked as generated
- **WHEN** the sync command completes successfully
- **THEN** the generated file starts with a header stating it is auto-generated and should not be edited by hand, and naming the source it was generated from

### Requirement: Resolve token aliases
A token value that references another token by name (e.g. `{brand-ring}`) SHALL be resolved to that other token's final converted value before being written to the generated file.

#### Scenario: Alias resolves to the referenced token's value
- **WHEN** a source token's value is an alias reference to another token defined in the same file
- **THEN** the generated file contains the referenced token's resolved value at the aliasing token's position, not the literal alias text

### Requirement: Convert oklch color values to a React Native-compatible format
Color tokens authored as `oklch()` SHALL be converted to hex (for opaque colors) or rgba (for colors with an alpha component) in the generated file. Color tokens already authored as hex SHALL pass through unchanged.

#### Scenario: Opaque oklch color converts to hex
- **WHEN** a color token's value is an `oklch(L C H)` string with no alpha component
- **THEN** the generated file contains the equivalent hex color for that token

#### Scenario: Oklch color with alpha converts to rgba
- **WHEN** a color token's value is an `oklch(L C H / A%)` string with an alpha component
- **THEN** the generated file contains an rgba color for that token preserving the alpha value

### Requirement: Convert rem and calc dimension values to pixel numbers
Spacing and radius tokens authored in `rem` SHALL be converted to numeric pixel values using a 16px base. A `calc()` expression of the form `<rem-value> * <number>` SHALL be evaluated to its resulting pixel value.

#### Scenario: Plain rem value converts to a pixel number
- **WHEN** a spacing or radius token's value is a plain `rem` dimension (e.g. `1rem`)
- **THEN** the generated file contains the equivalent numeric pixel value for that token (e.g. `16`)

#### Scenario: Calc multiplication expression converts to a pixel number
- **WHEN** a radius token's value is `calc(<rem-value> * <number>)`
- **THEN** the generated file contains the resulting numeric pixel value, computed from the rem base and the multiplier

### Requirement: Fail loudly when the source is missing or unparseable
The sync script SHALL exit with a non-zero status and a clear, actionable error message instead of producing a partial or silently-wrong output file when it cannot complete a sync.

#### Scenario: hire is not checked out as a sibling directory
- **WHEN** the sync script is run and `../hire/design-system/tokens/` does not exist
- **THEN** the script exits with a non-zero status and an error message stating that `hire` must be checked out as a sibling directory

#### Scenario: A token value uses an unsupported form
- **WHEN** a source token's value is a `calc()` expression, alias, or color format the script does not know how to convert
- **THEN** the script exits with a non-zero status and an error message naming the offending token and source file, and does not write a generated file
