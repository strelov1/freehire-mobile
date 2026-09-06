## Why

The Profile tab lists every saved skill as a chip. On a filled-in profile that is dozens of them —
five rows of specializations followed by ten of skills — filling half the screen with a list nobody
opens a settings tab to read. Every one of those chips is one tap away in the editor, where they can
also be changed rather than merely looked at.

The row above them already says `5 specializations · 68 skills`, which is what this screen actually
needs to convey.

## What Changes

- **The chip rows come off the Profile tab.** The row into the editor stays, counts and all.
- **The capability stops requiring them.** They were specified before the editor existed, when this
  screen was the only place a profile could be seen at all.

## Capabilities

### Modified Capabilities

- `mobile-profile-view`: the saved-profile section states its counts and offers the editor, rather
  than listing every value.

## Impact

- **Source:** `src/app/(tabs)/profile.tsx` only.
- **Not in this change:** the location summary, which is a handful of lines rather than a list, and
  stays.
