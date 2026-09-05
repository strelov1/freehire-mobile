import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import { JobMatchBlock } from '@/components/JobMatchBlock';
import type { MatchState } from '@/lib/jobMatch';
import type { JobMatchResult } from '@/lib/types';

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

function render(
  state: MatchState,
  match: JobMatchResult | null | undefined = null,
  isError = false,
) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <JobMatchBlock state={state} match={match} isError={isError} />,
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

describe('JobMatchBlock', () => {
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
