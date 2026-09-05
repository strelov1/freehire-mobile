## Why

Three surfaces in this app now end in the same dead end.

`openspec/specs/mobile-profile-view/spec.md` states it as policy — "mobile only reads the profile
the web app writes". `src/app/filters.tsx:96-100` hides its "Apply profile" button from a signed-in
user with no profile, in as many words: *mobile has nowhere to send them to create one*. And the
match block landed by `add-job-match-block` tells such a viewer to add skills to their profile while
being unable to offer a button, because the screen it would open does not exist.

Every one of those is the same missing screen. A candidate who installs the app, signs in, and wants
the match it advertises is currently told to go and use the website.

## What Changes

- **A signed-in user can edit their profile in the app.** A new screen edits specializations, the
  skills they hold, and the skills they would rather avoid — the three fields every one of those
  dead ends is waiting on.
- **The screen edits specializations, not only skills.** `PUT /api/v1/me/profile` rejects an empty
  specialization set and an empty skill set alike, so a "skills only" screen could not save a
  profile for the person who has none — precisely the person being sent to it.
- **Every save is a read-modify-write of the whole profile.** The endpoint replaces the row, and
  this app's `UserProfile` was a deliberate subset of it. Saving from that subset would silently
  drop the user's `seniorities` — desired levels they set on the web — so the type grows to carry
  the whole profile and the save sends back what it did not edit.
- **Saving a profile invalidates the match.** The coverage on any job screen is a statement about
  the skills that were just changed.
- **The three dead ends become entry points.** The match block's `no-profile` state gains its
  call-to-action, the Filters screen stops hiding "Apply profile" from a user who can now make one,
  and the Profile tab gains a way in.
- **The client mirrors the server's rules rather than discovering them.** At least one
  specialization and one skill, at most 10 specializations — the save button states what is missing
  instead of sending a request that returns 400.

## Capabilities

### New Capabilities

- `mobile-profile-editing`: the profile-editing screen — what it edits, what it preserves untouched,
  how it validates before saving, what a save invalidates, and how it behaves for a user who has no
  profile yet versus one who has.

### Modified Capabilities

- `mobile-profile-view`: the Profile tab stops being read-only. Its saved-profile section gains an
  entry point to the editor, and the capability's "editing is out of scope" premise is withdrawn.
- `job-profile-match`: the `no-profile` state gains the call-to-action it was specified without,
  now that there is a screen for it to open.

## Impact

- **Source:** `src/lib/types.ts` (`UserProfile` grows to the full server shape), `src/lib/api.ts`
  (`saveProfile`), a new `src/lib/useSaveProfile.ts`, a new `src/app/account/profile.tsx`, a
  `Stack.Screen` in `src/app/_layout.tsx`, `src/components/SkillChip.tsx` (lifted out of
  `filters.tsx`, which has had the three-state chip this needs all along), plus the three entry
  points.
- **Backend:** none. `PUT /api/v1/me/profile` exists, is cookie-gated, and this app's session is a
  cookie.
- **Not in this change:** editing seniorities or location preferences (preserved, not edited);
  uploading a CV; and claiming or avoiding a skill from a job's match chips, which is the change
  after next and reuses this one's save.
