import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import { TrackerActions } from '@/components/tracker/TrackerActions';

describe('TrackerActions', () => {
  it('renders move to saved and remove buttons', () => {
    const onMoveToSaved = jest.fn();
    const onRemove = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TrackerActions
          showMoveToSaved={true}
          isMovingToSaved={false}
          isRemoving={false}
          onMoveToSaved={onMoveToSaved}
          onRemove={onRemove}
        />,
      );
    });

    const text = renderedText(renderer).join(' ');
    expect(text).toContain('Move to Saved');
    expect(text).toContain('Remove from Tracker');

    const moveToSavedBtn = renderer.root.findByProps({ accessibilityLabel: 'Move to Saved list' });
    act(() => {
      moveToSavedBtn.props.onPress();
    });
    expect(onMoveToSaved).toHaveBeenCalled();

    const removeBtn = renderer.root.findByProps({ accessibilityLabel: 'Remove from Tracker' });
    act(() => {
      removeBtn.props.onPress();
    });
    expect(onRemove).toHaveBeenCalled();
  });

  it('hides move to saved button when showMoveToSaved is false', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TrackerActions
          showMoveToSaved={false}
          isMovingToSaved={false}
          isRemoving={false}
          onMoveToSaved={jest.fn()}
          onRemove={jest.fn()}
        />,
      );
    });

    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Move to Saved list' }).length).toBe(0);
    expect(renderer.root.findByProps({ accessibilityLabel: 'Remove from Tracker' })).toBeTruthy();
  });
});
