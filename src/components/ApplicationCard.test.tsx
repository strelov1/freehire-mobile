import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import { ApplicationCard } from '@/components/ApplicationCard';
import type { TrackedJob } from '@/lib/types';

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
  saved_at: null,
  applied_at: '2026-08-05T10:00:00Z',
  stage: 'interview',
  notes: 'First round done',
  email_count: 2,
  last_activity_at: '2026-08-05T10:00:00Z',
  days_silent: 12,
  silence_state: 'silent',
  followed_up_at: '2026-08-10T10:00:00Z',
  cv_opened_at: '2026-08-06T10:00:00Z',
};

function renderCard(item: TrackedJob, onPress = jest.fn()) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<ApplicationCard item={item} onPress={onPress} />);
  });
  return { renderer, onPress };
}

describe('ApplicationCard', () => {
  it('renders role title, company, stage badge, notes indicator, and email count', () => {
    const { renderer } = renderCard(sampleJob);
    const text = renderedText(renderer).join(' ');

    expect(text).toContain('Senior Backend Engineer');
    expect(text).toContain('Stripe');
    expect(text).toContain('Interview');
    expect(text).toContain('2 emails');
    expect(text).toContain('Notes');
    expect(text).toContain('No reply · 12d');
    expect(text).toContain('CV opened');
    expect(text).toContain('Chased');
  });

  it('renders pruned job with preserved company slug and closed marker', () => {
    const prunedJob: TrackedJob = {
      ...sampleJob,
      id: 'a123',
      company_slug: 'acme-corp',
      role_title: 'Staff Architect',
      job: null,
      notes: null,
      email_count: 0,
      followed_up_at: null,
      cv_opened_at: null,
      days_silent: null,
      silence_state: null,
    };

    const { renderer } = renderCard(prunedJob);
    const text = renderedText(renderer).join(' ');

    expect(text).toContain('Staff Architect');
    expect(text).toContain('acme-corp');
    expect(text).toContain('Posting closed');
  });

  it('handles saved row with no stage cleanly', () => {
    const savedJob: TrackedJob = {
      ...sampleJob,
      stage: null,
      applied_at: null,
      saved_at: '2026-08-01T00:00:00Z',
      days_silent: null,
      silence_state: null,
      notes: null,
      email_count: 0,
      followed_up_at: null,
      cv_opened_at: null,
    };

    const { renderer } = renderCard(savedJob);
    const text = renderedText(renderer).join(' ');

    expect(text).toContain('Saved');
    expect(text).not.toContain('No reply');
  });

  it('triggers onPress on pressable press', () => {
    const onPress = jest.fn();
    const { renderer } = renderCard(sampleJob, onPress);
    const pressable = renderer.root.findByProps({ accessibilityRole: 'button' });

    act(() => {
      pressable.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
