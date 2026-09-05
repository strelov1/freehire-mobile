## Context

This is the first of five changes porting `../hire`'s `job-profile-match` capability into the app.
The others — a profile skill-editing screen, the hard-constraint blockers, the locked-state teaser,
and claiming/avoiding a skill from a chip — build on what this one lands.

The contract is already settled by the backend and is not negotiable here:

- `GET /api/v1/jobs/:slug/match` returns `{"data": {total, exact_count, adjacent_count,
  coverage_percent, matched, adjacent, missing, blockers}}`. `adjacent` entries carry `{name, via}`
  — the specific held neighbour that satisfied the skill.
- `coverage_percent` is `round((exact_count + 0.5 × adjacent_count) / total × 100)`. An exact match
  weighs 1, an adjacent one a half.
- The classification is deterministic and runs no model. The adjacency dictionary
  (`internal/job/verdict/adjacent.go`) lives on the server and is not exported.
- Auth is cookie or API key. This app's session is a cookie plus a `sessionEpoch`
  (`src/lib/transport.ts`), which qualifies.
- An unknown slug is 404; so is a caller with no profile. Both are defensive paths — the client is
  expected not to ask in those states.

Three facts about this app shape the design.

**The device can already compute half of this.** `computeClientMatch` gives an exact-only overlap
with zero requests, and the feed's cards are built on it. That stays exactly as it is: a per-card
request is not on offer for a list. The detail screen is where one request buys the adjacency the
device cannot derive.

**Query cache is split by trust.** `src/lib/queryKeys.ts` separates `publicKeys` from `privateKeys`,
and `clearPrivateUserData` removes the private half on an identity change. The comment on the `plan`
key states the rule plainly — showing the previous user's Pro to the next one would be both wrong
and a way to sell them a plan they already have. A match is the same kind of statement.

**Skills are shown as slugs here.** The web maps them through a generated `SKILL_LABELS` catalog;
this app does not have it, and `filters.tsx` renders raw slugs. Importing the catalog for one block
would put a second source of truth about skill names in a repo that has none.

## Goals / Non-Goals

**Goals:**

- A signed-in viewer with profile skills sees, on a job, which of its skills they hold, which they
  half-hold and through what, and which they lack.
- No state that cannot produce a real match issues a request.
- A failed match never costs the viewer information they had before it was attempted.
- The state machine and the bar geometry are testable without rendering anything.

**Non-Goals:**

- Recomputing anything the server computed. The client does not hold the adjacency dictionary and
  will not approximate it.
- The blurred teaser, the blockers, the claim/avoid affordance, the skills editor. Named in the
  proposal, built in their own changes.
- Touching the feed card. Its client-side computation is right for a list.
- Skill display names.

## Decisions

### The state machine is pure, and it is what gates the request

`resolveMatchState({jobSkills, authenticated, profileLoaded, profileSkills})` is a direct port of the
web's, returning `no-skills | guest | loading | no-profile | ready`. `no-skills` wins over
everything (there is nothing personal to say about a job with no skills), then the auth gate, then
the profile gate. `loading` exists so the call-to-action does not flash before the profile settles.

The hook takes that state and passes `enabled: state === 'ready'`. The spec's requirement that the
guest and no-profile states must not call the endpoint is then a property of the wiring rather than
a rule a future caller has to remember.

### The state is resolved from `job.skills`, the row still falls back

`[slug].tsx:55` reads `job.skills?.length ? job.skills : job.enrichment?.skills ?? []`. The server
matches against the dictionary facet — `job.Skills` — and never looks at `enrichment`. Feeding the
fallback into `resolveMatchState` would classify an enrichment-only job as `ready`, spend a request,
and get `total: 0` back: a 0% match printed over skills that were never in the comparison.

So the block resolves from `job.skills` alone. The screen's own skill row keeps its fallback,
because there the list is the job's, not a comparison.

### The flat skill row yields to the block only once the block has groups

The obvious rule — hide the row when the state is `ready` — is wrong. `ready` means a request was
allowed, not that it succeeded. A network failure, a 5xx, or the defensive 404 from a profile
deleted in another tab would leave the row hidden and the block empty: the viewer loses the job's
skills entirely, in exchange for nothing.

The condition is therefore whether the block actually rendered its groups. A failed match is
reported quietly, in the block's own space, and the flat row stays where it was.

### `total: 0` from the server is `no-skills`, not 0%

If the client and server ever disagree about whether a job has skills, the honest reading of an
empty comparison is that there is nothing to compare — the state the spec already defines for it.
Zero percent is a claim about a candidate that nobody made.

### One request per (user, job), cached privately

The key is `privateKeys.jobMatch(userId, slug)`. Keyed on the slug, react-query switches cache
entries on navigation and cancels the outgoing request itself — the web needs a manual
`if (job.public_slug === slug)` guard after every await because it drives this from an effect, and
that guard is a cost this app does not have to pay. Keyed on the user id, the match leaves with the
user.

`authMode: 'required'`, so a 401 raises the transport's `UnauthorizedEvent` and the app's existing
re-auth path handles a session that expired mid-scroll, instead of the block silently emptying.

### Module boundaries

| Module | Owns | Depends on |
| --- | --- | --- |
| `lib/types.ts` | the wire shape: `AdjacentSkill`, `JobMatch`, `Blocker`, `JobMatchResult` | — |
| `lib/api.ts` | `getJobMatch(slug, signal)` | `transport` |
| `lib/jobMatch.ts` | `resolveMatchState`, `matchBarSegments` (beside the existing `computeClientMatch`) | — |
| `lib/useJobMatch.ts` | when to ask, under what key | api, queryKeys, authStore, useProfile |
| `components/JobMatchBlock.tsx` | what each state looks like | all of the above |

Only the component imports React. The state machine and the bar geometry are pure functions in a
file that already has unit tests, which is where the interesting cases are covered.

`Blocker` is typed in this change though nothing renders it: it is always present in the response,
and a type that describes half of a payload misdescribes it.

## Risks / Trade-offs

**The block is a second place where skills appear on the screen.** Mitigated by having it replace
the flat row rather than sit above it, which is why the "only once it has groups" rule above matters
enough to be a decision rather than an implementation detail.

**One more request on job open, for signed-in users with a profile.** It is one small deterministic
query, cached per job, and it buys the only signal on the screen the device cannot compute.

**Slug-rendered skill names.** `entra-id` rather than `Entra ID`. Consistent with the rest of the
app; the day this app wants display names it wants them everywhere, as its own change.

## Migration Plan

None. Additive: a new block on one screen, one new endpoint call, no stored state, no native
requirement, no change to what the feed card does.

## Open Questions

None blocking. The `no-profile` state renders a plain line here and gains its call-to-action when
the skills-editing screen exists — deliberately, so this change ships without a button that leads
nowhere.
