import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import { ApplicationStagePicker } from '@/components/ApplicationStagePicker';

function renderPicker(props: {
  visible?: boolean;
  currentStage?: string | null;
  onSelectStage?: (stage: any) => void;
  onClose?: () => void;
}) {
  const onSelectStage = props.onSelectStage ?? jest.fn();
  const onClose = props.onClose ?? jest.fn();

  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <ApplicationStagePicker
        visible={props.visible ?? true}
        currentStage={props.currentStage ?? 'interview'}
        onSelectStage={onSelectStage}
        onClose={onClose}
      />,
    );
  });
  return { renderer, onSelectStage, onClose };
}

describe('ApplicationStagePicker', () => {
  it('renders all active stages and closed outcomes', () => {
    const { renderer } = renderPicker({});
    const text = renderedText(renderer);

    expect(text).toContain('Active Pipeline');
    expect(text).toContain('Preparing');
    expect(text).toContain('Applied');
    expect(text).toContain('Screening');
    expect(text).toContain('Responded');
    expect(text).toContain('Interview');
    expect(text).toContain('Offer');

    expect(text).toContain('Closed Outcomes');
    expect(text).toContain('Accepted');
    expect(text).toContain('Rejected');
    expect(text).toContain('Withdrawn');
    expect(text).toContain('Expired');
  });

  it('selects an active stage', () => {
    const { renderer, onSelectStage, onClose } = renderPicker({});
    const option = renderer.root.findByProps({ accessibilityLabel: 'Select stage Offer' });

    act(() => {
      option.props.onPress();
    });

    expect(onSelectStage).toHaveBeenCalledWith('offer');
    expect(onClose).toHaveBeenCalled();
  });

  it('selects a closed outcome', () => {
    const { renderer, onSelectStage, onClose } = renderPicker({});
    const option = renderer.root.findByProps({ accessibilityLabel: 'Select closed outcome Rejected' });

    act(() => {
      option.props.onPress();
    });

    expect(onSelectStage).toHaveBeenCalledWith('rejected');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is tapped', () => {
    const { renderer, onClose } = renderPicker({});
    const closeBtn = renderer.root.findByProps({ accessibilityLabel: 'Close stage picker' });

    act(() => {
      closeBtn.props.onPress();
    });

    expect(onClose).toHaveBeenCalled();
  });
});
