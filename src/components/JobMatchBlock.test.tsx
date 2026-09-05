import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import { JobMatchBlock } from '@/components/JobMatchBlock';
import type { MatchState } from '@/lib/jobMatch';
import type { JobMatchResult } from '@/lib/types';

// The block writes one skill at a time through this hook. Mocked so these tests
// can state what the block DOES with a write's outcome — the write itself is
// covered by serialQueue's and profileEdit's own tests.
const mockClaims = {
  avoided: new Set<string>(),
  claim: jest.fn(async () => true),
  avoid: jest.fn(async () => true),
  unavoid: jest.fn(async () => true),
  undo: jest.fn(async () => true),
  pending: false,
  failed: null as string | null,
  last: null as { kind: 'claim' | 'avoid' | 'unavoid'; skill: string } | null,
};

jest.mock('@/lib/useSkillClaims', () => ({ useSkillClaims: () => mockClaims }));

/** The spec's worked example: 5 skills, 2 exact, 1 adjacent → 50%. */
const sampleMatch: JobMatchResult = {
  total: 5,
  exact_count: 2,
  adjacent_count: 1,
  coverage_percent: 50,
  matched: ['react', 'typescript'],
  adjacent: [{ name: 'aws', via: 'gcp' }],
  missing: ['graphql', 'nodejs'],
  blockers: [],
};

const JOB_SKILLS = ['react', 'typescript', 'graphql', 'nodejs', 'aws'];

function render(
  state: MatchState,
  match: JobMatchResult | null | undefined = null,
  isError = false,
  jobSkills: string[] = JOB_SKILLS,
) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <JobMatchBlock
        state={state}
        match={match}
        isError={isError}
        slug="stripe-senior-engineer"
        jobSkills={jobSkills}
      />,
    );
  });
  return renderer;
}

/** Every accessibility label a render exposed — the bar's figure lives here
 *  rather than in the text, its segments being unlabelled views. */
function labels(renderer: ReactTestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll((node) => typeof node.props?.accessibilityLabel === 'string')
    .map((node) => node.props.accessibilityLabel as string);
}

/** Press the chip whose accessible name starts with this skill. Awaited, since
 *  a press can start a write and an unawaited act leaks into the next test. */
async function pressChip(renderer: ReactTestRenderer.ReactTestRenderer, skill: string) {
  const chip = renderer.root.find(
    (n) =>
      n.props?.accessibilityRole === 'button' &&
      typeof n.props?.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(skill),
  );
  await act(async () => {
    await chip.props.onPress();
  });
}

/** Press an action button by its visible label. */
async function pressAction(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  const button = renderer.root.find(
    (n) => n.props?.accessibilityRole === 'button' && buttonText(n).includes(label),
  );
  await act(async () => {
    await button.props.onPress();
  });
}

/** The strings a button renders, for finding it by what it says. */
function buttonText(node: ReactTestRenderer.ReactTestInstance): string[] {
  return node.findAllByType(Text).map((text) =>
    React.Children.toArray(text.props.children)
      .filter((child): child is string | number => typeof child !== 'object')
      .join(''),
  );
}

describe('JobMatchBlock', () => {
  beforeEach(() => {
    mockClaims.avoided = new Set();
    mockClaims.pending = false;
    mockClaims.failed = null;
    mockClaims.last = null;
    mockClaims.claim.mockClear();
    mockClaims.avoid.mockClear();
    mockClaims.unavoid.mockClear();
    mockClaims.undo.mockClear();
  });

  describe('a real match', () => {
    it('shows the coverage, the counts and all three groups', () => {
      const text = renderedText(render('ready', sampleMatch)).join(' ');

      expect(text).toContain('50%');
      expect(text).toContain('3 of 5 skills');
      expect(text).toContain('You have');
      expect(text).toContain('react');
      expect(text).toContain('Close');
      expect(text).toContain('aws');
      expect(text).toContain('Missing');
      expect(text).toContain('graphql');
    });

    it('names the skill a close match was made through', () => {
      const renderer = render('ready', sampleMatch);

      expect(renderedText(renderer).join(' ')).toContain('gcp');
      expect(labels(renderer)).toContain('aws, close — you have gcp');
    });

    it('offers the bar as one figure rather than as two unlabelled views', () => {
      expect(labels(render('ready', sampleMatch))).toContain('50% match, 3 of 5 skills');
    });

    it('omits a group that has no skills', () => {
      const text = renderedText(
        render('ready', {
          ...sampleMatch,
          adjacent_count: 0,
          adjacent: [],
          missing: [],
          coverage_percent: 40,
        }),
      ).join(' ');

      expect(text).toContain('You have');
      expect(text).not.toContain('Close');
      expect(text).not.toContain('Missing');
    });
  });

  describe('claiming and avoiding a skill', () => {
    it('discloses a row naming the skill when a missing chip is pressed', async () => {
      const renderer = render('ready', sampleMatch);
      await pressChip(renderer, 'graphql');

      const text = renderedText(renderer).join(' ');
      expect(text).toContain('I have it');
      expect(text).toContain('Avoid');
    });

    it('offers a close chip’s own skill, not the neighbour it matched through', async () => {
      const renderer = render('ready', sampleMatch);
      await pressChip(renderer, 'aws');
      await pressAction(renderer, 'I have it');

      expect(mockClaims.claim).toHaveBeenCalledWith('aws');
    });

    it('keeps only one row open, and closes it on a second press', async () => {
      const renderer = render('ready', sampleMatch);

      await pressChip(renderer, 'graphql');
      await pressChip(renderer, 'nodejs');
      // One row, and it belongs to the chip pressed last.
      expect(renderedText(renderer).filter((t) => t === 'I have it')).toHaveLength(1);

      await pressChip(renderer, 'nodejs');
      expect(renderedText(renderer).join(' ')).not.toContain('I have it');
    });

    it('leaves held chips inert', () => {
      // This affordance adds skills; it never removes one.
      const renderer = render('ready', sampleMatch);
      const held = renderer.root.findAll(
        (n) => n.props?.accessibilityRole === 'button' && n.props?.accessibilityLabel === 'react',
      );

      expect(held).toHaveLength(0);
    });

    it('moves the skill and raises the coverage before the write settles', async () => {
      const renderer = render('ready', sampleMatch);
      await pressChip(renderer, 'graphql');
      await pressAction(renderer, 'I have it');

      // 3 exact of 5, no adjacent left untouched: (3 + 0.5) / 5 = 70%.
      const text = renderedText(renderer).join(' ');
      expect(text).toContain('70%');
      expect(text).toContain('4 of 5 skills');
    });

    it('does not move the match when a skill is avoided', async () => {
      // The server scores held skills alone, so an avoided skill is still one
      // the candidate does not have.
      const renderer = render('ready', sampleMatch);
      await pressChip(renderer, 'graphql');
      await pressAction(renderer, 'Avoid');

      const text = renderedText(renderer).join(' ');
      expect(mockClaims.avoid).toHaveBeenCalledWith('graphql');
      expect(text).toContain('50%');
      expect(text).toContain('graphql');
    });

    it('offers to stop avoiding a skill already avoided', async () => {
      mockClaims.avoided = new Set(['graphql']);
      const renderer = render('ready', sampleMatch);
      await pressChip(renderer, 'graphql');
      await pressAction(renderer, 'Stop avoiding');

      expect(mockClaims.unavoid).toHaveBeenCalledWith('graphql');
    });

    it('marks an avoided skill in its accessible name, not only by drawing it', () => {
      mockClaims.avoided = new Set(['graphql']);
      const renderer = render('ready', sampleMatch);
      const chip = renderer.root.find(
        (n) =>
          typeof n.props?.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith('graphql'),
      );

      expect(chip.props.accessibilityLabel).toContain('you avoid this skill');
    });

    it('names the last write and offers undo', () => {
      mockClaims.last = { kind: 'claim', skill: 'graphql' };
      const text = renderedText(render('ready', sampleMatch)).join(' ');

      expect(text).toContain('Added graphql to your profile.');
      expect(text).toContain('Undo');
    });

    it('reports a failed write instead of confirming it', () => {
      mockClaims.last = { kind: 'claim', skill: 'graphql' };
      mockClaims.failed = 'graphql';
      const text = renderedText(render('ready', sampleMatch)).join(' ');

      expect(text).toContain('Couldn’t update graphql');
      expect(text).not.toContain('Added graphql to your profile.');
      expect(text).not.toContain('Undo');
    });

    it('offers no claim affordance to a locked viewer', () => {
      // The teaser's chips are fabricated; claiming against them would invite a
      // candidate to correct a match nobody computed.
      const renderer = render('guest');
      const chips = renderer.root.findAll(
        (n) => n.props?.accessibilityRole === 'button' && n.props?.accessibilityState?.expanded !== undefined,
      );

      expect(chips).toHaveLength(0);
    });
  });

  describe('the requirements section', () => {
    const withBlockers: JobMatchResult = {
      ...sampleMatch,
      blockers: [
        {
          category: 'language',
          severity: 'soft',
          score_cap: 80,
          reason: 'Asks for German, your CV lists English',
          action: '',
          met: false,
        },
        {
          category: 'work_authorization',
          severity: 'hard',
          score_cap: 20,
          reason: 'Needs an EU work permit',
          action: '',
          met: false,
        },
        {
          category: 'education',
          severity: 'medium',
          score_cap: 60,
          reason: 'Degree requirement met',
          action: '',
          met: true,
        },
      ],
    };

    it('lists the unmet constraints hardest-first, then the met ones', () => {
      const text = renderedText(render('ready', withBlockers));
      const requirements = text.slice(text.indexOf('Requirements'));

      expect(requirements).toEqual([
        'Requirements',
        'Needs an EU work permit',
        'Asks for German, your CV lists English',
        'Degree requirement met',
      ]);
    });

    it('renders no section when the caller has no structured résumé', () => {
      // The server sends an empty array rather than erroring, and a heading over
      // nothing would claim requirements were assessed when they were not.
      expect(renderedText(render('ready', sampleMatch)).join(' ')).not.toContain('Requirements');
    });

    it('leaves the coverage untouched', () => {
      // Blockers are advisory: they cap nothing the client computes, and the
      // server's coverage comes from skills alone.
      const withText = renderedText(render('ready', withBlockers)).join(' ');
      const withoutText = renderedText(render('ready', sampleMatch)).join(' ');

      expect(withText).toContain('50%');
      expect(withoutText).toContain('50%');
      expect(withText).toContain('3 of 5 skills');
      expect(withoutText).toContain('3 of 5 skills');
    });
  });

  describe('the states that show no match', () => {
    it('says there is not enough data for a job with no skills', () => {
      expect(renderedText(render('no-skills')).join(' ')).toContain('Not enough data');
    });

    it('reads an empty comparison as no data, never as 0%', () => {
      const text = renderedText(
        render('ready', { ...sampleMatch, total: 0, exact_count: 0, adjacent_count: 0, coverage_percent: 0, matched: [], adjacent: [], missing: [] }),
      ).join(' ');

      expect(text).toContain('Not enough data');
      expect(text).not.toContain('0%');
    });

    it('invites a signed-out viewer to sign in', () => {
      const text = renderedText(render('guest')).join(' ');

      expect(text).toContain('Sign in');
    });

    it('shows a signed-out viewer the blurred teaser above the invitation', () => {
      const text = renderedText(render('guest')).join(' ');

      // Figures built from the job's own skills, not a fabricated list.
      expect(text).toMatch(/\d+%/);
      expect(text).toMatch(/\d+ of 5 skills/);
      expect(text).toContain('react');
    });

    it('shows a viewer with no profile skills the same teaser', () => {
      expect(renderedText(render('no-profile')).join(' ')).toMatch(/\d+ of 5 skills/);
    });

    it('leaves the call-to-action alone on a job with one skill', () => {
      // No have/missing contrast to draw, so no teaser — and no figure a viewer
      // could disprove.
      const text = renderedText(render('guest', null, false, ['react'])).join(' ');

      expect(text).toContain('Sign in');
      expect(text).not.toMatch(/\d+%/);
    });

    it('hides the teaser from assistive technology rather than reading out a score', () => {
      const renderer = render('guest');
      const hidden = renderer.root.findAll(
        (n) => n.props?.importantForAccessibility === 'no-hide-descendants',
      );

      // A screen reader offered "87% match" would be told a number about the
      // user that nobody computed; the blur that marks it as an invitation for
      // a sighted viewer does not exist in an accessibility tree.
      expect(hidden.length).toBeGreaterThan(0);
      expect(renderedText(renderer).join(' ')).toContain('Sign in');
    });

    it('offers a viewer with no profile skills the editor that would produce one', () => {
      const renderer = render('no-profile');
      const text = renderedText(renderer).join(' ');

      expect(text).toContain('Add skills to your profile');
      expect(text).toContain('Add skills');
      expect(
        renderer.root.findAll((n) => n.props?.accessibilityRole === 'button').length,
      ).toBeGreaterThan(0);
    });

    it('reports a failed match quietly, with no figure', () => {
      const text = renderedText(render('ready', null, true)).join(' ');

      expect(text).toContain('Couldn’t work out your match');
      expect(text).not.toContain('%');
    });
  });
});
