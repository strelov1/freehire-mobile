import { router } from 'expo-router';
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import { CompanyCard } from '@/components/CompanyCard';
import type { CompanyListItem } from '@/lib/types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

const base: CompanyListItem = {
  slug: 'stripe',
  name: 'Stripe',
  job_count: 82,
  tagline: 'Payments infrastructure for the internet',
  industries: ['Fintech', 'Payments'],
  hq_country: 'us',
  collections: [],
  feedback_count: 12,
  feedback_rating_avg: 4.62,
};

function render(company: CompanyListItem) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<CompanyCard company={company} />);
  });
  return renderer;
}

describe('CompanyCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the name, rating, role count, tagline, first industry and HQ country', () => {
    const shown = renderedText(render(base));
    expect(shown).toContain('Stripe');
    expect(shown).toContain('4.6');
    expect(shown).toContain('82 jobs');
    expect(shown).toContain('Payments infrastructure for the internet');
    expect(shown).toContain('Fintech');
    expect(shown).toContain('US');
  });

  it('shows only the first industry, not the whole list', () => {
    expect(renderedText(render(base))).not.toContain('Payments');
  });

  it('omits the rating when the company has none yet', () => {
    const shown = renderedText(render({ ...base, feedback_count: 0, feedback_rating_avg: null }));
    expect(shown).not.toContain('4.6');
    expect(shown).toContain('82 jobs');
  });

  it('says "1 job" for a single open role', () => {
    expect(renderedText(render({ ...base, job_count: 1 }))).toContain('1 job');
  });

  it('renders nothing for the fields a sparse company omits', () => {
    const shown = renderedText(
      render({
        ...base,
        tagline: null,
        industries: null,
        hq_country: null,
        feedback_rating_avg: null,
        feedback_count: 0,
      }),
    );
    expect(shown).toEqual(['Stripe', '82 jobs']);
  });

  it('opens the company screen on press', () => {
    const renderer = render(base);
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'Stripe, 82 jobs' }).props.onPress();
    });
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/companies/[slug]',
      params: { slug: 'stripe' },
    });
  });
});
