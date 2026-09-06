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
- [x] 3.2 The description becomes an About card clamped to three lines with a Show more/less toggle,
      shown only when the text overflows — measured by laying the full text out once, invisibly and
      out of the flow, and counting the lines it wanted.

## 3b. The overflowing match label

- [x] 3b.1 `src/components/JobCard.tsx` — the teaser's blur becomes a sibling laid over the strip
      instead of a wrapper around it. The wrapper rendered the strip's style twice, nesting the row
      inside itself, and the inner copy sized to content — which is what pushed the label past the
      card's edge.
- [x] 3b.2 `src/components/JobCard.test.tsx` — the teaser's strips are now marked as one accessible
      element carrying the invitation, so the tests assert that rather than the old hidden subtree.

## 4. Verification

- [x] 4.1 `npm run lint` and `npx tsc --noEmit` clean.
- [x] 4.2 Unit tests pass: 547 across 57 suites.
- [x] 4.3 On a simulator: sorting by Most viewed shows 156 / 123 / 111 in descending order, long-open
      postings read "Open 75d", a recent one reads "New · Be an early applicant", the match label
      sits inside the card again, and the company screen shows its About collapsed with the open
      roles above the fold.
