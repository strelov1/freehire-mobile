## 1. The signals

- [x] 1.1 `src/lib/format.ts` — `formatCount`, ported from the web: 1.2K / 15K / 1.3M.
- [x] 1.2 `src/lib/reality.ts` — `freshnessBadges`, thresholds and gates ported from the web's
      `cardFreshnessBadges`: no reality signal, no claim.
- [x] 1.3 `src/lib/reality.test.ts` — every gate, including the closed posting and the distrusted
      date.
- [x] 1.4 `src/lib/types.ts` — correct the comment marking `reality` as detail-only.

## 2. The card

- [x] 2.1 View count beside the timestamp, abbreviated, exact figure for assistive technology, and
      absent at zero.
- [x] 2.2 The reality badge and the freshness badges lead the signal row.

## 3. The company screen

- [x] 3.1 `src/app/companies/[slug].tsx` — the logo and name move into the back rail at 32px, the
      shape the job screen uses. The tagline stays, in the body.

## 4. Verification

- [x] 4.1 `npm run lint` and `npx tsc --noEmit` clean.
- [x] 4.2 Unit tests pass: 547 across 57 suites.
- [x] 4.3 On a simulator: sorting by Most viewed shows 156 / 123 / 111 in descending order, long-open
      postings read "Open 75d", and a recent one reads "New · Be an early applicant".
