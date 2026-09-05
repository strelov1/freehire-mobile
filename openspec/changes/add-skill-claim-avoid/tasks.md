## 1. Pure logic

- [x] 1.1 `src/lib/jobMatch.ts` — `claimSkill(match, skill)`: the optimistic reading once a skill is
      claimed, recomputed with the server's own weighting. A skill the job doesn't carry, or one
      already held, yields the match untouched. Ported from the web.
- [x] 1.2 `src/lib/profileEdit.ts` — `claimSkillInProfile`, `avoidSkillInProfile`,
      `unavoidSkillInProfile`: each returning a whole profile, each keeping a skill out of both
      lists at once.
- [x] 1.3 Tests: the claimed-adjacent case (exact up, adjacent down, coverage up by the half
      weight), the no-op cases, and each profile write's effect on both lists.

## 2. Serialised writes

- [x] 2.1 `src/lib/useProfileWrites.ts` — a queue over `saveProfile` that builds each write from the
      result of the previous one, so two writes in quick succession cannot be built from the same
      snapshot and drop each other. Seeds `['profile']` and invalidates the job-match prefix as
      `useSaveProfile` does.
- [x] 2.2 Tests: two writes enqueued before the first settles both persist, and the second is built
      from the first's result. Covered at the queue (`serialQueue.test.ts`), which is where the
      ordering lives; `useProfileWrites` itself is the thin wiring of that queue to the cache.

## 3. The block

- [x] 3.1 Missing and Close chips become controls disclosing a row that names the skill; You have
      chips stay inert; one row open at a time.
- [x] 3.2 The row offers "I have it" and "Avoid" — or "Stop avoiding" for a skill already avoided.
- [x] 3.3 A claim renders optimistically, then refetches once the write lands; a failed refetch
      keeps the optimistic view.
- [x] 3.4 An avoid moves nothing and refetches nothing.
- [x] 3.5 A confirmation names the last write and offers undo, which subtracts only that skill.
- [x] 3.6 A failed write rolls the chip back and reports it; no confirmation for a write that did
      not land.
- [x] 3.7 Avoided skills render struck through, with an accessible name saying so, from the profile
      the block already holds.
- [x] 3.8 No affordance in any locked state.

## 4. Verification

- [x] 4.1 `npm run lint` and `npx tsc --noEmit` clean.
- [x] 4.2 Unit tests pass: 515 across 55 suites.
