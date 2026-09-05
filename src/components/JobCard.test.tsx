import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import { JobCard } from '@/components/JobCard';
import type { Job } from '@/lib/types';

// The swipe wrapper pulls in reanimated's worklets, which have no native side in
// jest — the reason this card had no render test until now. It contributes
// nothing to what is asserted here, so it stands in as a passthrough.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

// The card reads four hooks for state that has nothing to do with what it draws
// here. Mocked so each test can state one thing: who is looking at the card.
const mockAuth = { user: null as { id: number } | null };
const mockProfile = { data: null as { skills: string[] } | null };

jest.mock('@/lib/authStore', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/useProfile', () => ({ useProfile: () => mockProfile }));
jest.mock('@/lib/useSavedJobs', () => ({
  useSavedJobs: () => ({ isSaved: () => false, toggle: jest.fn() }),
}));
jest.mock('@/lib/useDismissedJobs', () => ({
  useDismissedJobs: () => ({ hide: jest.fn() }),
}));

const job: Job = {
  public_slug: 'stripe-senior-engineer',
  title: 'Senior Backend Engineer',
  company: 'Stripe',
  skills: ['react', 'typescript', 'graphql', 'nodejs', 'aws'],
  enrichment: { salary_min: 120000, salary_max: 160000, salary_currency: 'USD', salary_period: 'year' },
} as Job;

function render(item: Job = job) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<JobCard job={item} />);
  });
  return renderer;
}

/** The subtrees hidden from assistive technology — which is how the teaser
 *  marks its fabricated figures. */
function hiddenSubtrees(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findAll((n) => n.props?.importantForAccessibility === 'no-hide-descendants');
}

function hasHiddenSubtree(renderer: ReactTestRenderer.ReactTestRenderer): boolean {
  return hiddenSubtrees(renderer).length > 0;
}

/** Every string rendered INSIDE a hidden subtree, so a test can state what the
 *  blur covers and what it deliberately leaves out. */
function hiddenText(renderer: ReactTestRenderer.ReactTestRenderer): string {
  return hiddenSubtrees(renderer)
    .flatMap((node) => node.findAllByType(Text))
    .map((node) =>
      React.Children.toArray(node.props.children)
        .filter((child): child is string | number => typeof child !== 'object')
        .join(''),
    )
    .join(' ');
}

describe('JobCard profile match', () => {
  beforeEach(() => {
    mockAuth.user = null;
    mockProfile.data = null;
  });

  it('shows a signed-out viewer the blurred teaser', () => {
    const renderer = render();
    const text = renderedText(renderer).join(' ');

    expect(text).toMatch(/\d+% · \d+\/5 skills/);
    expect(hasHiddenSubtree(renderer)).toBe(true);
  });

  it('shows a signed-in viewer with no profile skills the same teaser', () => {
    mockAuth.user = { id: 7 };
    mockProfile.data = { skills: [] };

    expect(renderedText(render()).join(' ')).toMatch(/\d+% · \d+\/5 skills/);
  });

  it('shows a viewer with profile skills their real coverage, unblurred', () => {
    mockAuth.user = { id: 7 };
    mockProfile.data = { skills: ['react', 'typescript'] };

    const renderer = render();

    // Two of five held, computed on the device — not a teaser figure.
    expect(renderedText(renderer).join(' ')).toContain('40% · 2/5 skills');
    expect(hasHiddenSubtree(renderer)).toBe(false);
  });

  it('keeps the salary legible under the teaser', () => {
    // The teaser is an invitation, not a paywall over the job: the blur covers
    // the chips and the coverage strip, and the pay is outside it.
    const renderer = render();

    expect(renderedText(renderer).join(' ')).toContain('120');
    expect(hiddenText(renderer)).not.toContain('120');
  });

  it('leaves a job with one skill as a plain card', () => {
    const renderer = render({ ...job, skills: ['react'] } as Job);

    expect(renderedText(renderer).join(' ')).not.toMatch(/\d+% ·/);
    expect(hasHiddenSubtree(renderer)).toBe(false);
  });

  it('derives the same teaser figures on every render of one job', () => {
    const first = renderedText(render()).find((t) => t.includes('skills'));
    const second = renderedText(render()).find((t) => t.includes('skills'));

    // A score that re-rolled as the list remounted the card would be caught out
    // by the user's own thumb.
    expect(first).toBe(second);
  });
});
