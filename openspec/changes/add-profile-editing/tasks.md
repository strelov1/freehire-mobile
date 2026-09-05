## 1. The contract, widened

- [x] 1.1 `src/lib/types.ts` — `UserProfile` gains `seniorities: string[]`, and its comment stops
      saying the app has no editing screen. This is the field a subset-shaped write would have
      silently wiped.
- [x] 1.2 `src/lib/api.ts` — `saveProfile(profile, signal)`: `PUT /api/v1/me/profile` with the full
      body (`specializations`, `skills`, `seniorities`, `excluded_skills`, `location_preferences`),
      `authMode: 'required'`, returning the saved profile the response carries.

## 2. Pure logic

- [x] 2.1 `src/lib/profileEdit.ts` — the editor's rules with no React: `validateProfileEdit(draft)`
      returning the unmet rule (no specialization, no skill, more than ten specializations) or
      nothing, and `profileWrite(draft, loaded)` building the full write from the edited fields plus
      the untouched ones.
- [x] 2.2 `src/lib/profileEdit.test.ts` — each rule; a write that preserves seniorities and location
      preferences; a draft built from a `null` profile (the user who has none).

## 3. Data

- [x] 3.1 `src/lib/useSaveProfile.ts` — `useMutation` over `saveProfile`, seeding `['profile']` from
      the response rather than refetching it, and invalidating the `['private', userId,
      'job-match']` prefix, since a skill change moves every cached match.
- [x] 3.2 `src/lib/queryKeys.ts` — the job-match prefix as a named key, so the invalidation is not
      an array literal spelled out at the call site.

## 4. The screen

- [x] 4.1 `src/components/SkillChip.tsx` — lift the three-state chip out of `src/app/filters.tsx`
      unchanged, and import it there. Off → held → avoided is the cycle both screens need.
- [x] 4.2 `src/app/account/profile.tsx` — specializations (from the `category` facet, labelled the
      way the Filters screen labels them) above skills (from the `skills` facet, searched and
      debounced the same way), a save action, and the states: signed out, profile loading, load
      failed, saving, saved, save failed.
- [x] 4.3 The save action states the unmet rule from `validateProfileEdit` instead of issuing a
      request the server would answer 400.
- [x] 4.4 A failed save keeps the draft on screen and offers a retry.
- [x] 4.5 `src/app/_layout.tsx` — register the screen.

## 5. The entry points

- [x] 5.1 `src/components/JobMatchBlock.tsx` — the `no-profile` state gains its call-to-action.
- [x] 5.2 `src/app/filters.tsx` — stop hiding "Apply profile" from a signed-in user with no profile;
      it now opens the editor instead of being absent.
- [x] 5.3 `src/app/(tabs)/profile.tsx` — an edit action on the saved-profile section, and the
      no-profile empty state stops pointing at the web app. The section itself had to be BUILT:
      `mobile-profile-view` specifies the saved profile's chips and the file's own header claims
      them, but no such section existed and its styles (`profileBody`, `chipRow`) were orphaned.
      The spec had drifted from the code before this change; adding the entry point to a section
      that wasn't there would have left it drifted.

## 6. Verification

- [x] 6.1 `npm run lint` and `npx tsc --noEmit` clean.
- [x] 6.2 Unit tests pass: 464 across 53 suites, including the new validation and write-building
      cases and the updated `JobMatchBlock` no-profile case.
- [ ] 6.3 By hand against a real API base: create a profile as a user with none, edit one as a user
      with seniorities set on the web and confirm they survive, and confirm a job's match changes
      after a skill is added. Needs a device or simulator and a signed-in account — not done in
      this session.
