## Why

The match block now tells a candidate which of a job's skills they lack. It is frequently wrong
about that, and in one direction: the profile is a short list somebody typed once, and the job asks
for things they have done for years but never wrote down. Every such skill reads as Missing, on this
job and on every other job that asks for it.

The candidate is looking straight at the correction, on the chip. The last of the five changes lets
them make it there — and lets them say the opposite too: that a skill is one they would rather not
be shown.

## What Changes

- **A Missing or Close chip becomes a control.** Pressing it discloses a row naming that skill and
  offering two answers: add it to the profile, or record it as one to avoid.
- **You have chips stay inert.** This affordance adds skills; it never removes one.
- **A claim is reflected before the write settles**, recomputed with the server's own weighting — an
  exact match weighs 1, an adjacent one a half — so the optimistic figure cannot drift from what the
  server will answer. Once the write lands the block refetches, because a claim can also promote a
  third skill from missing to close through an adjacency dictionary the client does not hold.
- **A claim is confirmed and reversible.** Undo subtracts that skill alone — never restores a whole
  earlier profile, which would roll back any claim made after it.
- **An avoid does not move the match.** The server computes coverage from held skills alone, so an
  avoided skill is still one the candidate does not have; re-scoring, or dropping the chip from
  Missing, would imply otherwise. No refetch either: nothing in the match can have changed.
- **An avoided skill is marked wherever it appears**, read off the profile the block already holds,
  so the mark reaches every job asking for that skill with no extra request.
- **Writes are serialised.** `PUT /me/profile` replaces the row, so two claims confirmed in quick
  succession would otherwise be built from the same stale snapshot and one would silently vanish.
- **A locked viewer cannot claim anything.** The teaser's chips are fabricated; making them
  actionable would invite a candidate to claim a skill against a match nobody computed.

## Capabilities

### Modified Capabilities

- `job-profile-match`: the block's chips gain the claim/avoid affordance, its optimistic
  recomputation, its confirmations, and its rules about what each write may and may not move.

## Impact

- **Source:** `src/lib/profileEdit.ts` (claim/avoid/un-avoid over a profile), `src/lib/jobMatch.ts`
  (the optimistic `claimSkill`), a write queue beside `useSaveProfile`, `JobMatchBlock`, and tests
  for each.
- **Backend:** none. `PUT /me/profile` is the same endpoint the profile editor already uses, and it
  already subtracts the avoided set from the held one.
- **Not in this change:** claiming from a feed card (its chips are a client-side approximation, and
  a per-card write has no match to reconcile against), and the web's LLM deep-dive analysis.
