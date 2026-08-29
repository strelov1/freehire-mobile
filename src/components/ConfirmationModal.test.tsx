import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import { ConfirmationModal } from './ConfirmationModal';

describe('ConfirmationModal', () => {
  it('renders title, message, and buttons when visible', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ConfirmationModal
          visible={true}
          title="Remove from Tracker?"
          message="This will remove the application from your tracking board."
          confirmText="Remove"
          confirmVariant="danger"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
    });

    const text = renderedText(renderer).join(' ');
    expect(text).toContain('Remove from Tracker?');
    expect(text).toContain('This will remove the application from your tracking board.');
    expect(text).toContain('Cancel');
    expect(text).toContain('Remove');

    const confirmBtn = renderer.root.findByProps({ accessibilityLabel: 'Remove' });
    act(() => {
      confirmBtn.props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    const cancelBtn = renderer.root.findByProps({ accessibilityLabel: 'Cancel' });
    act(() => {
      cancelBtn.props.onPress();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
