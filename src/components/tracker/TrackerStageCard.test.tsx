import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import { TrackerStageCard } from '@/components/tracker/TrackerStageCard';

describe('TrackerStageCard', () => {
  it('renders stage label and applied date', () => {
    const onChangeStagePress = jest.fn();
    const onMarkAppliedToday = jest.fn();
    const onSetPreparing = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TrackerStageCard
          currentStageLabel="Interview"
          appliedDate="Aug 1, 2026"
          eligibleForApply={false}
          isSavedGroup={false}
          isMarkingApplied={false}
          isUpdatingStage={false}
          onChangeStagePress={onChangeStagePress}
          onMarkAppliedToday={onMarkAppliedToday}
          onSetPreparing={onSetPreparing}
        />,
      );
    });

    const text = renderedText(renderer).join(' ');
    expect(text).toContain('Current stage');
    expect(text).toContain('Interview');
    expect(text).toContain('Applied Aug 1, 2026');
    expect(text).toContain('Change stage');

    const changeBtn = renderer.root.findByProps({ accessibilityLabel: 'Change application stage' });
    act(() => {
      changeBtn.props.onPress();
    });
    expect(onChangeStagePress).toHaveBeenCalled();
  });

  it('renders quick action buttons when eligible for apply and saved group', () => {
    const onMarkAppliedToday = jest.fn();
    const onSetPreparing = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TrackerStageCard
          currentStageLabel="Saved"
          appliedDate={null}
          eligibleForApply={true}
          isSavedGroup={true}
          isMarkingApplied={false}
          isUpdatingStage={false}
          onChangeStagePress={jest.fn()}
          onMarkAppliedToday={onMarkAppliedToday}
          onSetPreparing={onSetPreparing}
        />,
      );
    });

    const text = renderedText(renderer).join(' ');
    expect(text).toContain('Ready to update?');
    expect(text).toContain('Mark as applied today');
    expect(text).toContain('Or set Preparing');

    const markAppliedBtn = renderer.root.findByProps({ accessibilityLabel: 'Mark as applied today' });
    act(() => {
      markAppliedBtn.props.onPress();
    });
    expect(onMarkAppliedToday).toHaveBeenCalled();

    const setPreparingBtn = renderer.root.findByProps({ accessibilityLabel: 'Set stage to preparing' });
    act(() => {
      setPreparingBtn.props.onPress();
    });
    expect(onSetPreparing).toHaveBeenCalled();
  });
});
