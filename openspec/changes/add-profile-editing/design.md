## Context

Second of the five changes porting `../hire`'s profile match. `add-job-match-block` shipped the
match itself and deliberately left its `no-profile` state without a button; this change builds what
that button opens, and the claim/avoid change after it reuses this one's save.

What the backend fixes, and this change cannot argue with:

- `PUT /api/v1/me/profile` is **create-or-replace of the whole row**. Its body is
  `{specializations, skills, seniorities, excluded_skills, location_preferences}`; whatever is
  omitted is not preserved, it is replaced with nothing.
- `userprofile.Save` rejects an empty specialization set (`ErrEmptySpecializations`) and an empty
  skill set (`ErrEmptySkills`), caps specializations at 10, and validates each against the category
  vocabulary. Skills are lowercased, trimmed, de-duplicated and capped at 200; values over 64
  characters are dropped rather than failing the save.
- The server subtracts the excluded set from the held set (`subtractSkills`), so a skill can never
  end up in both lists however the client sends them.
- `GET /api/v1/me/profile` returns the full row plus read-only extras (`derived_location`, `cv`,
  timestamps), so a read-modify-write has everything it needs.
- Cookie-gated. This app's session is a cookie plus a `sessionEpoch`, so it qualifies.

And what this app brings to it: `filters.tsx` already contains the exact controls this screen needs
— a debounced search over the `skills` facet distribution, and a three-state chip that cycles a
skill off → wanted → avoided. The facet source is public (`/api/v1/jobs/facets`), and
`jobFilters.ts:196` already reads the `category` facet the specializations come from.

## Goals / Non-Goals

**Goals:**

- A signed-in user with no profile can create one in the app; one with a profile can change it.
- A save never loses a field the screen does not edit.
- The screen refuses a save the server would reject, and says which rule is unmet.
- A changed profile is reflected on every job's match without a stale read.

**Non-Goals:**

- Editing seniorities or location preferences. Preserved verbatim; giving them controls is its own
  change, and the profile-view screen already renders location read-only.
- CV upload, and anything derived from a CV.
- Claiming a skill from a job's chips. Next change but one; it will call this change's save.
- A second design system. The chips and the search box are the ones `filters.tsx` already has.

## Decisions

### `UserProfile` grows to the full server shape

Today it is four fields with a comment explaining why — "mobile has no profile-editing screen, so it
only reads the fields `filtersFromProfile` seeds the job filters from". That premise is what this
change removes, and the subset becomes actively dangerous the moment it is used to build a write:
`seniorities` is absent from it, PUT replaces the row, so the first save from this app would wipe
the desired levels the user set on the web — silently, with no error and nothing on screen to
suggest it happened.

So the type gains `seniorities`, and the save is a read-modify-write over the profile the screen
already fetched. The read-only extras the response carries (`cv`, `derived_location`, timestamps)
are not added: they are not writable, so nothing can drop them.

This is the whole reason the screen must have loaded the profile before it can save one. For a user
who has none, "loaded" is a settled `null` — an answer, not an absence.

### The screen edits specializations too

A screen called "skills" cannot save a profile for a user who has none, because the server requires
at least one specialization in the same request. The alternatives were to invent a default
specialization (a claim about the candidate nobody made) or to restrict the screen to users who
already have a profile (leaving the dead ends exactly as they are for the people hitting them).

So it edits both, with skills given the larger share of the screen — that is what every entry point
is asking for — and specializations above them as the shorter, capped list.

### Validation mirrors the server, in the button

At least one specialization, at least one skill, at most ten specializations. The save button is
disabled until they hold and names what is missing. The server's other rules — lowercasing,
de-duplication, dropping an over-long value — are normalisations rather than refusals, so the client
does not duplicate them; it sends what was picked and renders back what the server stored.

The response of a successful `PUT` is the saved profile in the same shape as the read, so it seeds
the cache directly rather than triggering a refetch.

### A save invalidates the match, not just the profile

`privateKeys.jobMatch(userId, slug)` is keyed per job, and a skill change moves every one of them.
The mutation invalidates the whole `['private', userId, 'job-match']` prefix along with `['profile']`
— a coverage figure computed against the skills the user just changed is wrong on the screen behind
this one.

### `SkillChip` moves out of `filters.tsx`

It is already a three-state chip cycling off → include → exclude, which is exactly held → avoided →
neither. Copying it would leave two chips that must be kept looking alike by hand; it moves to
`src/components/SkillChip.tsx` and both screens import it.

## Risks / Trade-offs

**A read-modify-write over a row the web can change concurrently.** The endpoint has no
optimistic-concurrency guard on this path (`Upsert`, not `UpsertIfUnchanged`), so a profile edited on
the web while this screen is open is overwritten on save. The window is a screen a user opened
deliberately; the alternative is a conflict protocol the endpoint does not offer. Recorded rather
than solved.

**The skill vocabulary comes from the facet distribution**, so it lists the skills that appear in
live jobs, busiest first — not the whole dictionary. A candidate cannot claim a skill no posting
mentions. That is the same limit the Filters screen has, and for the profile it is nearly harmless:
a skill no job asks for cannot change any match.

## Migration Plan

None. Additive, plus one type widening. An existing profile is read and written in the shape the
server already serves.

## Open Questions

None blocking.
