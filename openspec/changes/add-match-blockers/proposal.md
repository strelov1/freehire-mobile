## Why

`GET /api/v1/jobs/:slug/match` has been answering with a `blockers` array since before this app
called it, and `add-job-match-block` typed it deliberately — "typing half a payload would
misdescribe it" — while rendering nothing.

They are the deterministic hard-constraint checks: required years, education, certifications, work
authorization, location and work mode, each with the reason it is or is not met. A candidate reading
a 70% skill match has no way to see, on that screen, that the role needs a work permit they do not
hold — the one fact most likely to decide the outcome, and the cheapest one to show, because it is
already in the response the screen has.

## What Changes

- **The match block gains a Requirements section**, listing the unmet constraints first — hardest
  first — then the met ones as satisfied.
- **Unmet constraints are toned by severity.** A hard constraint (work authorization, a required
  certification) reads as blocking; a softer fit constraint (location, language) reads as a caution.
- **They are advisory and stay advisory.** Nothing here hides, downranks, filters or greys out the
  job, and the coverage figure does not move because of them. The backend is explicit that a blocker
  never does either, and the app follows.
- **A caller with no structured résumé sees no section at all.** The array comes back empty rather
  than erroring, and an empty Requirements heading would state something the server did not.

## Capabilities

### Modified Capabilities

- `job-profile-match`: the block gains the requirements section beside its skill coverage —
  what it lists, in what order, and what it must never do to the job.

## Impact

- **Source:** `src/lib/jobMatch.ts` (`partitionBlockers`, `blockerTone`), its tests,
  `src/components/JobMatchBlock.tsx`, and its tests.
- **Backend:** none. The data is already in the response the screen fetches; this change makes no
  new request.
- **Not in this change:** the LLM deep-dive match analysis the web offers below its blockers, and
  anything that acts on a blocker (there is nothing to act on — they are statements about the
  candidate's own résumé, not about the job).
