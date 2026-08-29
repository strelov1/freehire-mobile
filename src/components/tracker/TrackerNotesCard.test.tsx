import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { TrackerNotesCard } from '@/components/tracker/TrackerNotesCard';

describe('TrackerNotesCard', () => {
  it('renders notes and handles typing', () => {
    const onChangeNotes = jest.fn();
    const onSaveNotes = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TrackerNotesCard
          notes="Initial note"
          isDirty={false}
          isSaving={false}
          onChangeNotes={onChangeNotes}
          onSaveNotes={onSaveNotes}
        />,
      );
    });

    const input = renderer.root.findByType(TextInput);
    expect(input.props.value).toBe('Initial note');

    // Save button not visible when not dirty
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Save notes' }).length).toBe(0);

    act(() => {
      input.props.onChangeText('Updated note');
    });
    expect(onChangeNotes).toHaveBeenCalledWith('Updated note');
  });

  it('renders save button when isDirty is true', () => {
    const onSaveNotes = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TrackerNotesCard
          notes="Dirty note"
          isDirty={true}
          isSaving={false}
          onChangeNotes={jest.fn()}
          onSaveNotes={onSaveNotes}
        />,
      );
    });

    const saveBtn = renderer.root.findByProps({ accessibilityLabel: 'Save notes' });
    act(() => {
      saveBtn.props.onPress();
    });
    expect(onSaveNotes).toHaveBeenCalled();
  });
});
