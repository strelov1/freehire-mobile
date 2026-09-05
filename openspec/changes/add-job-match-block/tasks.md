## 1. The contract

- [ ] 1.1 `src/lib/types.ts` — `AdjacentSkill { name, via }`, `JobMatch { total, exact_count,
      adjacent_count, coverage_percent, matched, adjacent, missing }`, `Blocker { category,
      severity, score_cap, reason, action, met }` and `JobMatchResult = JobMatch & { blockers:
      Blocker[] }`, ported by hand from the backend's generated contracts (this app has no
      `gen-contracts`). `Blocker` is typed though nothing renders it yet.
- [ ] 1.2 `src/lib/api.ts` — `getJobMatch(slug, signal)` over `request()` with
      `authMode: 'required'`, unwrapping `{data}` like its neighbours.

## 2. Pure logic

- [ ] 2.1 `src/lib/jobMatch.ts` — `resolveMatchState({jobSkills, authenticated, profileLoaded,
      profileSkills})` returning `no-skills | guest | loading | no-profile | ready`, in the
      precedence the web uses: no-skills, then auth, then profile.
- [ ] 2.2 `src/lib/jobMatch.ts` — `matchBarSegments({total, exact_count, adjacent_count})`
      returning the two segment widths as percentages of the track, zero-safe at `total: 0`.
- [ ] 2.3 Extend `src/lib/jobMatch.test.ts`: every state including the enrichment-only job that
      must resolve to `no-skills`; segment widths for the 5/2/1 case in the spec; the zero case.

## 3. Data

- [ ] 3.1 `src/lib/queryKeys.ts` — `privateKeys.jobMatch(userId, slug)`, beside the existing
      private keys so `clearPrivateUserData` sweeps it on an identity change.
- [ ] 3.2 `src/lib/useJobMatch.ts` — react-query on the shape of `useJob`, but private: the key
      above, `enabled: state === 'ready'`. The state, not the caller, is what prevents a request.

## 4. The block

- [ ] 4.1 `src/components/JobMatchBlock.tsx` — resolves its own state from `job.skills`, `useAuth`
      and `useProfile`, and renders: `no-skills` (not enough data), `guest` (sign-in line + a
      button to `/auth`), `loading`, `no-profile` (a plain line — its call-to-action arrives with
      the skills-editing screen), `ready` (percent, two-segment bar, three chip groups).
- [ ] 4.2 A `total: 0` response renders the not-enough-data state, never `0%`.
- [ ] 4.3 A failed request renders a quiet unavailable line, and reports upward that it has no
      groups, so the screen can keep its own skill row.
- [ ] 4.4 Accessibility: one label on the bar carrying the percentage and counts, segments hidden;
      Close chips name their `via` skill in their accessible name as well as on screen.
- [ ] 4.5 Built on `getColors`/`Space`/`Radius` from `@/constants/freehire` — brand tint for held,
      warning for close, destructive-muted for missing, matching what `JobCard` already uses.

## 5. The screen

- [ ] 5.1 `src/app/jobs/[slug].tsx` — mount the block as its own card under `RealityBadge`.
- [ ] 5.2 Hide the metadata card's flat skill row only while the block is rendering its groups;
      the row keeps its `enrichment.skills` fallback in every other case.
- [ ] 5.3 Update the stale file header: the screen has an account, a `SaveButton`, and now a match.

## 6. Verification

- [ ] 6.1 `npm run lint` and `npx tsc --noEmit` clean (strict, `noUncheckedIndexedAccess`).
- [ ] 6.2 Unit tests pass, including the new state-machine and segment cases.
- [ ] 6.3 Walk the states by hand against a real API base: signed out, signed in without skills,
      signed in with skills, a job with no skills, and a job whose skills are enrichment-only.
