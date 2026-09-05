/**
 * The profile editor's rules, with no React and no network — so the two things
 * that can quietly lose a user's data are testable on their own: what counts as
 * a saveable edit, and what a save actually sends.
 *
 * Mirrors `userprofile.Save` on the server (`../hire/internal/identity/
 * userprofile/userprofile.go`) only where the server REFUSES: an empty
 * specialization set, an empty skill set, more than ten specializations. Its
 * normalisations — lowercasing, trimming, de-duplication, dropping an over-long
 * value, subtracting the avoided set from the held one — are not duplicated
 * here. Reimplementing them would give the app a second opinion about what a
 * profile contains, and the server answers a save with what it stored anyway.
 */

import type { UserProfile } from './types';

/** The server's cap (`MaxSpecializations`). Skills are capped at 200 there, far
 *  above anything this screen's facet-fed list can produce, so it isn't mirrored. */
export const MAX_SPECIALIZATIONS = 10;

/** What the editor holds while it is being edited: the two fields the screen
 *  offers controls for, plus the avoided set its skill chips also produce. */
export type ProfileDraft = {
  specializations: string[];
  skills: string[];
  excludedSkills: string[];
};

/** The draft an editor opens with. A user with no profile starts empty — a
 *  settled `null` is an answer, not an absence, and starting them at a default
 *  specialization would put a claim in their profile that they never made. */
export function draftFromProfile(profile: UserProfile | null | undefined): ProfileDraft {
  return {
    specializations: profile?.specializations ?? [],
    skills: profile?.skills ?? [],
    excludedSkills: profile?.excluded_skills ?? [],
  };
}

/** Why this draft cannot be saved, in the words the screen shows — or null when
 *  it can. Stated before the request rather than discovered from a 400. */
export function validateProfileEdit(draft: ProfileDraft): string | null {
  if (draft.specializations.length === 0) return 'Choose at least one specialization.';
  if (draft.skills.length === 0) return 'Choose at least one skill.';
  if (draft.specializations.length > MAX_SPECIALIZATIONS) {
    return `Choose at most ${MAX_SPECIALIZATIONS} specializations.`;
  }
  return null;
}

/**
 * The full profile to PUT: the edited fields, plus the ones this screen has no
 * controls for carried over from the profile it was read from.
 *
 * That carry-over is the whole point. The endpoint replaces the row, so a write
 * built from the draft alone would clear the user's seniorities and location
 * preferences — set on the web, invisible here, and gone with no error and
 * nothing on screen to suggest it happened.
 *
 * `loaded` being null is the user who has no profile yet: there is nothing to
 * preserve, and the write creates one.
 */
export function profileWrite(draft: ProfileDraft, loaded: UserProfile | null | undefined): UserProfile {
  return {
    specializations: draft.specializations,
    skills: draft.skills,
    excluded_skills: draft.excludedSkills,
    seniorities: loaded?.seniorities ?? [],
    location_preferences: loaded?.location_preferences ?? null,
  };
}

/** A skill's three states in the editor, the same cycle the Filters screen uses:
 *  neither → held → avoided → neither. The server subtracts the avoided set from
 *  the held one, so the two can never disagree even if a caller sent both. */
export type SkillState = 'off' | 'include' | 'exclude';

export function skillState(draft: ProfileDraft, skill: string): SkillState {
  if (draft.skills.includes(skill)) return 'include';
  if (draft.excludedSkills.includes(skill)) return 'exclude';
  return 'off';
}

export function cycleDraftSkill(draft: ProfileDraft, skill: string): ProfileDraft {
  const state = skillState(draft, skill);
  if (state === 'off') return { ...draft, skills: [...draft.skills, skill] };
  if (state === 'include') {
    return {
      ...draft,
      skills: draft.skills.filter((s) => s !== skill),
      excludedSkills: [...draft.excludedSkills, skill],
    };
  }
  return { ...draft, excludedSkills: draft.excludedSkills.filter((s) => s !== skill) };
}

/**
 * The three writes the match block's chips produce, each returning a whole
 * profile ready for `saveProfile`.
 *
 * Each keeps the skill out of both lists at once. The server enforces the same
 * rule (`subtractSkills`), but a client that sent a contradiction and then
 * rendered its own request back would show the user a profile the server never
 * stored.
 *
 * A `null` profile — a viewer with none — cannot reach these: the chips only
 * exist in the real-match state, which requires a profile with skills.
 */
export function claimSkillInProfile(profile: UserProfile, skill: string): UserProfile {
  return {
    ...profile,
    skills: profile.skills.includes(skill) ? profile.skills : [...profile.skills, skill],
    excluded_skills: profile.excluded_skills.filter((s) => s !== skill),
  };
}

export function avoidSkillInProfile(profile: UserProfile, skill: string): UserProfile {
  return {
    ...profile,
    skills: profile.skills.filter((s) => s !== skill),
    excluded_skills: profile.excluded_skills.includes(skill)
      ? profile.excluded_skills
      : [...profile.excluded_skills, skill],
  };
}

/** Undoing an avoid, and undoing a claim, are the same shape: take one skill out
 *  of one list and leave the other alone. Undo subtracts THAT skill rather than
 *  restoring an earlier profile wholesale, which would roll back any write made
 *  after it. */
export function unavoidSkillInProfile(profile: UserProfile, skill: string): UserProfile {
  return { ...profile, excluded_skills: profile.excluded_skills.filter((s) => s !== skill) };
}

export function unclaimSkillInProfile(profile: UserProfile, skill: string): UserProfile {
  return { ...profile, skills: profile.skills.filter((s) => s !== skill) };
}

export function toggleSpecialization(draft: ProfileDraft, value: string): ProfileDraft {
  return draft.specializations.includes(value)
    ? { ...draft, specializations: draft.specializations.filter((s) => s !== value) }
    : { ...draft, specializations: [...draft.specializations, value] };
}
