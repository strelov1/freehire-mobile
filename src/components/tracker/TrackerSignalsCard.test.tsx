import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import { TrackerSignalsCard } from '@/components/tracker/TrackerSignalsCard';

describe('TrackerSignalsCard', () => {
  it('renders signals when present', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TrackerSignalsCard
          silenceText="No reply · 14d"
          cvOpenedAgo="2 days ago"
          followedUpAgo="5 days ago"
          emailCount={3}
        />,
      );
    });

    const text = renderedText(renderer).join(' ');
    expect(text).toContain('Signals & Activity');
    expect(text).toContain('No reply · 14d');
    expect(text).toContain('Opened 2 days ago');
    expect(text).toContain('Chased 5 days ago');
    expect(text).toContain('3 messages');
  });

  it('renders empty message when no signals are present', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TrackerSignalsCard
          silenceText={null}
          cvOpenedAgo={null}
          followedUpAgo={null}
          emailCount={0}
        />,
      );
    });

    const text = renderedText(renderer).join(' ');
    expect(text).toContain('No active signals recorded yet.');
  });
});
