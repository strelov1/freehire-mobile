## 1. Pure logic

- [x] 1.1 `src/lib/jobMatch.ts` — `partitionBlockers(blockers)` splitting unmet from met and
      ordering the unmet by `score_cap` ascending (a lower cap is a harder blocker), ported from
      the web's `jobMatch.ts`.
- [x] 1.2 `src/lib/jobMatch.ts` — `blockerTone(severity)` returning which palette tone an unmet
      constraint reads in. The web returns a Tailwind class; here it returns a token name, since
      this app's colours are palette lookups rather than classes.
- [x] 1.3 `src/lib/jobMatch.test.ts` — the split, the hardest-first order, a null/undefined array,
      and each severity's tone.

## 2. The block

- [x] 2.1 `src/components/JobMatchBlock.tsx` — a Requirements section under the skill groups:
      unmet reasons toned by severity, then met reasons marked satisfied.
- [x] 2.2 No section at all when there are no blockers — an empty heading would state that
      requirements were assessed when they were not.
- [x] 2.3 `src/components/JobMatchBlock.test.tsx` — both lists rendered, hardest first, the empty
      case absent, and the coverage figures unchanged by the presence of blockers.

## 3. Verification

- [x] 3.1 `npm run lint` and `npx tsc --noEmit` clean.
- [x] 3.2 Unit tests pass: 472 across 53 suites.
