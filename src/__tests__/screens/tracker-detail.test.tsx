import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import TrackerDetailScreen from '@/app/tracker/[id]';
import type { TrackedJob } from '@/lib/types';
import { useTrackedJobs, useTrackerMutations } from '@/lib/useTracker';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/lib/useTracker', () => ({
  useTrackedJobs: jest.fn(),
  useTrackerMutations: jest.fn(),
}));

const mockedUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<
  typeof useLocalSearchParams
>;
const mockedUseTrackedJobs = useTrackedJobs as jest.MockedFunction<typeof useTrackedJobs>;
const mockedUseTrackerMutations = useTrackerMutations as jest.MockedFunction<
  typeof useTrackerMutations
>;

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
  notes: 'Original notes',
  email_count: 1,
  last_activity_at: null,
  days_silent: null,
  silence_state: null,
  followed_up_at: null,
  cv_opened_at: null,
};

let mounted: ReactTestRenderer.ReactTestRenderer | null = null;

describe('TrackerDetailScreen', () => {
  let mutations: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');

    mockedUseLocalSearchParams.mockReturnValue({ id: 'stripe-senior-eng' });

    mutations = {
      markApplied: jest.fn().mockResolvedValue({}),
      updateStage: jest.fn().mockResolvedValue({}),
      updateNotes: jest.fn().mockResolvedValue({}),
      moveToSaved: jest.fn().mockResolvedValue({}),
      removeFromTracker: jest.fn().mockResolvedValue({}),
      isMarkingApplied: false,
      isUpdatingStage: false,
      isUpdatingNotes: false,
      isMovingToSaved: false,
      isRemoving: false,
    };

    mockedUseTrackerMutations.mockReturnValue(mutations);

    mockedUseTrackedJobs.mockReturnValue({
      data: {
        data: [sampleJob],
        meta: { total: 1, limit: 500, offset: 0, counts: { all: 1, viewed: 0, saved: 1, applied: 0, board: 1, dismissed: 0 } },
      },
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

  function renderScreen() {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<TrackerDetailScreen />);
    });
    mounted = renderer;
    return renderer;
  }

  it('renders application details and saved actions for saved job', () => {
    const renderer = renderScreen();
    const text = renderedText(renderer).join(' ');

    expect(text).toContain('Senior Backend Engineer');
    expect(text).toContain('Stripe');
    expect(text).toContain('Current stage');
    expect(text).toContain('Saved');
    expect(text).toContain('Mark as applied today');
    expect(text).toContain('Or set Preparing');
    expect(text).toContain('1 message');
  });

  it('shows not found when id does not match any tracked job', () => {
    mockedUseLocalSearchParams.mockReturnValue({ id: 'non-existent' });
    const renderer = renderScreen();
    const text = renderedText(renderer).join(' ');

    expect(text).toContain('Application not found');
  });

  it('handles mark applied confirmation flow', () => {
    const renderer = renderScreen();
    const applyBtn = renderer.root.findByProps({ accessibilityLabel: 'Mark as applied today' });

    act(() => {
      applyBtn.props.onPress();
    });

    const confirmBtn = renderer.root.findByProps({ accessibilityLabel: 'Confirm Applied' });
    act(() => {
      confirmBtn.props.onPress();
    });

    expect(mutations.markApplied).toHaveBeenCalledWith('stripe-senior-eng', 'stripe-senior-eng');
  });

  it('handles notes drafting and explicit save', async () => {
    const renderer = renderScreen();
    const input = renderer.root.findByType(TextInput);

    act(() => {
      input.props.onChangeText('Updated interview notes');
    });

    const saveBtn = renderer.root.findByProps({ accessibilityLabel: 'Save notes' });
    await act(async () => {
      await saveBtn.props.onPress();
    });

    expect(mutations.updateNotes).toHaveBeenCalledWith('stripe-senior-eng', 'Updated interview notes');
  });

  it('handles remove confirmation flow', () => {
    const renderer = renderScreen();
    const removeBtn = renderer.root.findByProps({ accessibilityLabel: 'Remove from Tracker' });

    act(() => {
      removeBtn.props.onPress();
    });

    const confirmBtn = renderer.root.findByProps({ accessibilityLabel: 'Remove' });
    act(() => {
      confirmBtn.props.onPress();
    });

    expect(mutations.removeFromTracker).toHaveBeenCalledWith('stripe-senior-eng');
  });

  it('renders pruned job gracefully without View Job or Move to Saved', () => {
    const prunedRow: TrackedJob = {
      ...sampleJob,
      id: 'a999',
      job: null,
      stage: 'interview',
    };

    mockedUseLocalSearchParams.mockReturnValue({ id: 'a999' });
    mockedUseTrackedJobs.mockReturnValue({
      data: {
        data: [prunedRow],
        meta: { total: 1, limit: 500, offset: 0, counts: { all: 1, viewed: 0, saved: 0, applied: 1, board: 1, dismissed: 0 } },
      },
      isLoading: false,
    } as any);

    const renderer = renderScreen();
    const text = renderedText(renderer).join(' ');

    expect(text).toContain('Posting closed');
    expect(text).toContain('Interview');
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'View original job posting' }).length).toBe(0);
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Move to Saved list' }).length).toBe(0);
  });
});
