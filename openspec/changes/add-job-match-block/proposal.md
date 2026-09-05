## Why

The app already computes a profile match — but only the cheap half of one. `src/lib/jobMatch.ts`
ports the web's `computeClientMatch`: an exact, case-insensitive set intersection between a job's
skills and the viewer's profile skills, computed on the device with no request. It tints the chips
and draws the coverage strip on a feed card (`src/components/JobCard.tsx:88-234`).

The job-detail screen has none of it. `src/app/jobs/[slug].tsx:142-150` renders every skill as the
same brand-tinted badge, whether the viewer holds it or has never touched it, and the file's own
header still says the auth-only features are "omitted — this app has no account" (a line that
outlived `SaveButton` sitting three lines below it).

Meanwhile the backend has been serving the real thing all along. `GET /api/v1/jobs/:slug/match`
classifies each of a job's skills as exact, **adjacent** (a neighbour the viewer holds, per a
curated dictionary the client does not have) or missing, and returns a coverage percent that weighs
an exact match as 1 and an adjacent one as one half. That adjacency is the whole point: the
device-side computation cannot know that `gcp` says something about `aws`, so every card in this app
currently reports a candidate as missing skills they half-have.

## What Changes

- **The job-detail screen gains a profile-match block.** For a signed-in viewer with profile
  skills it calls `GET /api/v1/jobs/:slug/match` and renders the coverage percent, a two-segment
  bar, and three chip groups — You have, Close (each naming the neighbour it matched through), and
  Missing.
- **The block replaces the flat skill row when, and only when, it renders those groups.** The same
  skills, told apart instead of listed. If the request fails, the flat row stays: a personal signal
  that could not be computed is no reason to take the job's own skills off the screen.
- **Four states, chosen without a wasted request.** `no-skills`, `guest`, `loading`, `no-profile`
  and `ready` are resolved from what the screen already knows; only `ready` is allowed to call the
  endpoint, expressed as react-query's `enabled` rather than as caller discipline.
- **The match is private cache.** It is keyed under `privateKeys` with the user id, so
  `clearPrivateUserData` drops it on an identity change. A match is a statement about one person.
- **The state is resolved from `job.skills` alone**, not from the screen's
  `skills || enrichment.skills` fallback. The server matches on the dictionary facet only, so a job
  whose skills exist solely in `enrichment` would otherwise produce a request answering `total: 0` —
  a 0% match where nothing was ever comparable.

## Capabilities

### New Capabilities

- `job-profile-match`: the per-job server-computed match on the detail screen — what the block
  shows in each of its states, which states may call the endpoint, how exact and adjacent skills
  are weighed and drawn, and what happens to the job's own skill row when the match cannot be had.

## Impact

- **Source:** `src/lib/types.ts` (the match contract, ported by hand — this app has no
  `gen-contracts`), `src/lib/api.ts` (`getJobMatch`), `src/lib/jobMatch.ts` (`resolveMatchState`,
  `matchBarSegments`), `src/lib/queryKeys.ts` (one private key), a new `src/lib/useJobMatch.ts`, a
  new `src/components/JobMatchBlock.tsx`, and `src/app/jobs/[slug].tsx`.
- **Backend:** none. The endpoint, its auth (`RequireAuthOrKey`, and this app's cookie session
  qualifies) and its payload already exist and are unchanged by this work.
- **Skill names** render as the dictionary slugs the API returns, as every other surface in this
  app already does (`filters.tsx` renders `label={skill}`). The web's `SKILL_LABELS` catalog is
  generated and stays in the web.
- **Not in this change:** the blurred locked-state teaser for guests and viewers without a profile
  (they get a plain line here); the `blockers[]` the same response carries, which is typed now and
  drawn later; claiming or avoiding a skill from a chip; and the profile skill-editing screen that
  the `no-profile` state will eventually send a viewer to. Each is its own change.
