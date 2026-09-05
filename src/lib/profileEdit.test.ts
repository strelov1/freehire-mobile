import {
  avoidSkillInProfile,
  claimSkillInProfile,
  cycleDraftSkill,
  draftFromProfile,
  profileWrite,
  skillState,
  toggleSpecialization,
  unavoidSkillInProfile,
  unclaimSkillInProfile,
  validateProfileEdit,
  type ProfileDraft,
} from './profileEdit';
import type { UserProfile } from './types';

const savedProfile: UserProfile = {
  specializations: ['software_engineering'],
  skills: ['react', 'typescript'],
  seniorities: ['senior', 'lead'],
  excluded_skills: ['wordpress'],
  location_preferences: { relocation: { open: true, countries: ['de'] } },
};

const validDraft: ProfileDraft = {
  specializations: ['software_engineering'],
  skills: ['react'],
  excludedSkills: [],
};

describe('draftFromProfile', () => {
  it('seeds from a saved profile', () => {
    expect(draftFromProfile(savedProfile)).toEqual({
      specializations: ['software_engineering'],
      skills: ['react', 'typescript'],
      excludedSkills: ['wordpress'],
    });
  });

  it('starts empty for a user with no profile', () => {
    // A settled null is an answer, not an absence — and seeding a default
    // specialization would put a claim in their profile they never made.
    expect(draftFromProfile(null)).toEqual({
      specializations: [],
      skills: [],
      excludedSkills: [],
    });
  });
});

describe('validateProfileEdit', () => {
  it('accepts a draft with a specialization and a skill', () => {
    expect(validateProfileEdit(validDraft)).toBeNull();
  });

  it('refuses a draft with no specialization', () => {
    expect(validateProfileEdit({ ...validDraft, specializations: [] })).toContain('specialization');
  });

  it('refuses a draft with no skill', () => {
    expect(validateProfileEdit({ ...validDraft, skills: [] })).toContain('skill');
  });

  it('refuses more than ten specializations', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `spec_${i}`);
    expect(validateProfileEdit({ ...validDraft, specializations: eleven })).toContain('10');
  });

  it('accepts exactly ten', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `spec_${i}`);
    expect(validateProfileEdit({ ...validDraft, specializations: ten })).toBeNull();
  });
});

describe('profileWrite', () => {
  it('carries over the fields the editor has no controls for', () => {
    // The endpoint replaces the whole row: a write built from the draft alone
    // would clear seniorities and location preferences set on the web, with no
    // error and nothing on screen to suggest it happened.
    const write = profileWrite({ ...validDraft, skills: ['react', 'go'] }, savedProfile);

    expect(write.seniorities).toEqual(['senior', 'lead']);
    expect(write.location_preferences).toEqual(savedProfile.location_preferences);
  });

  it('sends the edited fields', () => {
    const write = profileWrite(
      { specializations: ['data'], skills: ['sql'], excludedSkills: ['php'] },
      savedProfile,
    );

    expect(write.specializations).toEqual(['data']);
    expect(write.skills).toEqual(['sql']);
    expect(write.excluded_skills).toEqual(['php']);
  });

  it('creates a profile for a user who has none', () => {
    const write = profileWrite(validDraft, null);

    expect(write.seniorities).toEqual([]);
    expect(write.location_preferences).toBeNull();
    expect(write.skills).toEqual(['react']);
  });
});

describe('cycleDraftSkill', () => {
  it('cycles a skill through held, avoided and neither', () => {
    const empty: ProfileDraft = { specializations: [], skills: [], excludedSkills: [] };

    const held = cycleDraftSkill(empty, 'react');
    expect(skillState(held, 'react')).toBe('include');

    const avoided = cycleDraftSkill(held, 'react');
    expect(skillState(avoided, 'react')).toBe('exclude');
    expect(avoided.skills).not.toContain('react');

    const off = cycleDraftSkill(avoided, 'react');
    expect(skillState(off, 'react')).toBe('off');
    expect(off.excludedSkills).not.toContain('react');
  });

  it('never leaves a skill in both lists', () => {
    const draft = cycleDraftSkill(cycleDraftSkill(validDraft, 'go'), 'go');

    expect(draft.skills).not.toContain('go');
    expect(draft.excludedSkills).toContain('go');
  });
});

describe('toggleSpecialization', () => {
  it('adds one that is absent and removes one that is present', () => {
    const added = toggleSpecialization(validDraft, 'data');
    expect(added.specializations).toEqual(['software_engineering', 'data']);

    expect(toggleSpecialization(added, 'data').specializations).toEqual(['software_engineering']);
  });
});

describe('the match block’s profile writes', () => {
  const profile: UserProfile = {
    ...savedProfile,
    skills: ['react', 'typescript'],
    excluded_skills: ['wordpress'],
  };

  it('claims a skill into the held set', () => {
    expect(claimSkillInProfile(profile, 'graphql').skills).toEqual([
      'react',
      'typescript',
      'graphql',
    ]);
  });

  it('claiming a skill the profile avoids resolves the contradiction', () => {
    // A skill is never in both lists — the server subtracts one from the other,
    // and a client that sent both would render back a profile it never stored.
    const after = claimSkillInProfile(profile, 'wordpress');

    expect(after.skills).toContain('wordpress');
    expect(after.excluded_skills).not.toContain('wordpress');
  });

  it('avoiding a skill takes it out of the held set', () => {
    const after = avoidSkillInProfile(profile, 'react');

    expect(after.skills).not.toContain('react');
    expect(after.excluded_skills).toContain('react');
  });

  it('does not duplicate a skill already in the target list', () => {
    expect(claimSkillInProfile(profile, 'react').skills).toEqual(['react', 'typescript']);
    expect(avoidSkillInProfile(profile, 'wordpress').excluded_skills).toEqual(['wordpress']);
  });

  it('undoes one write without restoring an earlier profile wholesale', () => {
    // Restoring a snapshot would roll back any write made after the one being
    // undone.
    const two = claimSkillInProfile(claimSkillInProfile(profile, 'bash'), 'powershell');
    const undone = unclaimSkillInProfile(two, 'powershell');

    expect(undone.skills).toContain('bash');
    expect(undone.skills).not.toContain('powershell');
  });

  it('un-avoiding leaves the held set untouched', () => {
    const after = unavoidSkillInProfile(profile, 'wordpress');

    expect(after.excluded_skills).not.toContain('wordpress');
    expect(after.skills).toEqual(['react', 'typescript']);
  });
});
