## 1. Pure logic

- [x] 1.1 `src/lib/jobMatch.ts` — `matchTeaser(seed, jobSkills)`: FNV-1a over the slug seeding a
      mulberry32 PRNG; percent in [60, 90] capped per skill count so one skill always reads as
      missing; `matched` derived from the percent, never rolled beside it; null under two skills.
      Ported from the web's `jobMatch.ts`.
- [x] 1.2 `src/lib/jobMatch.ts` — `teaserChips(jobSkills, missing, limit)`: the leading skills, but
      trading the last for the first missing one when the window came out all-held.
- [x] 1.3 `src/lib/jobMatch.test.ts` — determinism, the band, matched-follows-percent, both tones
      present, null under two skills, and the all-held window trade.

## 2. The job screen

- [x] 2.1 `src/components/JobMatchBlock.tsx` — the `guest` and `no-profile` states render the
      teaser above their call-to-action, under an `expo-blur` view.
- [x] 2.2 No teaser, no divider: a single-skill job leaves the call-to-action standing alone.
- [x] 2.3 The teaser is hidden from assistive technology; an invitation naming what signing in (or
      adding skills) would show is exposed in its place.
- [x] 2.4 Still no request in either locked state — `useJobMatch` already enforces it; the tests
      state it.

## 3. The card

- [x] 3.1 `src/components/JobCard.tsx` — a locked viewer's card renders the teaser: chips tinted
      from the teaser's own missing set, plus the coverage strip, under a blur.
- [x] 3.2 The blur covers the chips and the strip only. The salary sits outside it.
- [x] 3.3 A viewer with profile skills is unaffected: the real client-computed bar, unblurred.
- [x] 3.4 Tests for all three viewers, and for the single-skill job that keeps the plain card.

## 4. Verification

- [x] 4.1 `npm run lint` and `npx tsc --noEmit` clean.
- [x] 4.2 Unit tests pass: 490 across 54 suites.
- [ ] 4.3 By hand: the same job's teaser figures do not change while scrolling the feed, and the
      job screen and the card agree on them. Needs a device or simulator — not done in this
      session; the determinism is covered by unit tests either way.
