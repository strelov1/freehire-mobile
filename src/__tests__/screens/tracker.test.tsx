import { router } from 'expo-router';
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import TrackerScreen from '@/app/(tabs)/tracker';
import { useAuth } from '@/lib/authStore';
import type { TrackedJob, TrackingPage } from '@/lib/types';
import { useTrackedJobs } from '@/lib/useTracker';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
}));

jest.mock('@/lib/authStore', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/useTracker', () => ({
  useTrackedJobs: jest.fn(),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseTrackedJobs = useTrackedJobs as jest.MockedFunction<typeof useTrackedJobs>;

const sampleJob: TrackedJob = {
  id: 'stripe-senior-eng',
  company_slug: 'stripe',
  role_title: 'Senior Backend Engineer',
  job: {
    public_slug: 'stripe-senior-eng',
    title: 'Senior Backend Engineer',
    company: 'Stripe',
  },
  viewed_at: '2026-08-01T10:00:00Z',
  saved_at: '2026-08-01T11:00:00Z',
  applied_at: null,
  stage: null,
  notes: null,
  email_count: 0,
  last_activity_at: null,
  days_silent: null,
  silence_state: null,
  followed_up_at: null,
  cv_opened_at: null,
};

const defaultPage: TrackingPage = {
  data: [
    { ...sampleJob, id: '1', role_title: 'Senior Backend Engineer', stage: null, saved_at: '2026-08-01' },
    { ...sampleJob, id: '2', role_title: 'Go Architect', stage: 'interview', applied_at: '2026-08-05' },
  ],
  meta: {
    total: 2,
    limit: 500,
    offset: 0,
    counts: { all: 2, viewed: 0, saved: 1, applied: 1, board: 2, dismissed: 0 },
  },
};

let mounted: ReactTestRenderer.ReactTestRenderer | null = null;

function renderScreen() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<TrackerScreen />);
  });
  mounted = renderer;
  return renderer;
}

describe('TrackerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: 1, email: 'user@example.com', role: 'user', beta_tester: false },
      status: 'authenticated',
      sessionEpoch: 1,
      isAuthenticated: true,
      retryBootstrap: jest.fn(),
    } as any);

    mockedUseTrackedJobs.mockReturnValue({
      data: defaultPage,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    } as any);
  });

  afterEach(() => {
    act(() => {
      mounted?.unmount();
    });
    mounted = null;
  });

  it('renders guest card when unauthenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      status: 'anonymous',
      sessionEpoch: 0,
      isAuthenticated: false,
      retryBootstrap: jest.fn(),
    } as any);

    const renderer = renderScreen();
    const text = renderedText(renderer).join(' ');

    expect(text).toContain('Track your applications');
    expect(text).toContain('Sign in to use Tracker');

    const button = renderer.root.findByProps({ accessibilityLabel: 'Sign in or create account' });
    act(() => {
      button.props.onPress();
    });
    expect(router.push).toHaveBeenCalledWith('/auth');
  });

  it('renders empty state when there are no applications', () => {
    mockedUseTrackedJobs.mockReturnValue({
      data: { data: [], meta: { total: 0, limit: 500, offset: 0, counts: { all: 0, viewed: 0, saved: 0, applied: 0, board: 0, dismissed: 0 } } },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    } as any);

    const renderer = renderScreen();
    const text = renderedText(renderer).join(' ');

    expect(text).toContain('No applications yet');
    expect(text).toContain('Browse jobs');
  });

  it('renders populated list with filter chips and counts', () => {
    const renderer = renderScreen();
    const text = renderedText(renderer).join(' ');

    expect(text).toContain('Applications');
    expect(text).toContain('All 2');
    expect(text).toContain('Saved 1');
    expect(text).toContain('Interview 1');
    expect(text).toContain('Senior Backend Engineer');
    expect(text).toContain('Go Architect');
  });

  it('shows bounded 500 warning when total exceeds returned data', () => {
    mockedUseTrackedJobs.mockReturnValue({
      data: {
        ...defaultPage,
        meta: { ...defaultPage.meta, total: 550 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    } as any);

    const renderer = renderScreen();
    const text = renderedText(renderer).join(' ');

    expect(text).toContain('Showing first 2 of 550 applications');
  });

  it('switches filter tab and narrows visible items', () => {
    const renderer = renderScreen();
    const savedChip = renderer.root.findByProps({ accessibilityLabel: 'Filter by Saved, 1 jobs' });

    act(() => {
      savedChip.props.onPress();
    });

    const text = renderedText(renderer).join(' ');
    expect(text).toContain('Senior Backend Engineer');
    expect(text).not.toContain('Go Architect');
  });
});
