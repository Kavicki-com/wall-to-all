import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Slider } from '../components/ui/Slider';

const fireAction = (el: Parameters<typeof fireEvent>[0], actionName: string) =>
  fireEvent(el, 'accessibilityAction', { nativeEvent: { actionName } });

// Sem onLayout sob RNTL, trackWidth mantém o padrão CONTAINER_WIDTH=168 e o thumb
// tem 24px (THUMB_SIZE), então a matemática valor→pixel é determinística:
//   ratio    = clamp((value - min) / (max - min), 0, 1)
//   fillWidth = ratio * 168
//   thumbX    = ratio * (168 - 24)  // = ratio * 144
const TRACK_WIDTH = 168;
const THUMB_SIZE = 24;
const flatStyle = (el: Parameters<typeof fireEvent>[0]) => StyleSheet.flatten(el.props.style);

describe('Slider', () => {
  it('uses accessibilityRole="adjustable"', () => {
    const { getByRole } = render(<Slider value={30} min={0} max={100} onValueChange={jest.fn()} />);
    expect(getByRole('adjustable')).toBeTruthy();
  });

  it('exposes the current value through the adjustable a11y value', () => {
    const { getByRole } = render(<Slider value={30} min={0} max={100} onValueChange={jest.fn()} />);
    expect(getByRole('adjustable').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 30,
    });
  });

  it('renders the label as visible text when provided', () => {
    const { getByText } = render(
      <Slider value={30} min={0} max={100} onValueChange={jest.fn()} label="Raio" />,
    );
    expect(getByText('Raio')).toBeTruthy();
  });

  it('declares increment and decrement accessibility actions', () => {
    const { getByRole } = render(<Slider value={30} min={0} max={100} onValueChange={jest.fn()} />);
    expect(getByRole('adjustable').props.accessibilityActions).toEqual([
      { name: 'increment' },
      { name: 'decrement' },
    ]);
  });

  it('increments by step on the increment action', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Slider value={30} min={0} max={100} step={5} onValueChange={onValueChange} />,
    );
    fireAction(getByRole('adjustable'), 'increment');
    expect(onValueChange).toHaveBeenCalledWith(35);
  });

  it('decrements by step on the decrement action', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Slider value={30} min={0} max={100} step={5} onValueChange={onValueChange} />,
    );
    fireAction(getByRole('adjustable'), 'decrement');
    expect(onValueChange).toHaveBeenCalledWith(25);
  });

  it('defaults step to 1', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Slider value={30} min={0} max={100} onValueChange={onValueChange} />,
    );
    fireAction(getByRole('adjustable'), 'increment');
    expect(onValueChange).toHaveBeenCalledWith(31);
  });

  it('clamps at the maximum on increment', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Slider value={100} min={0} max={100} step={5} onValueChange={onValueChange} />,
    );
    fireAction(getByRole('adjustable'), 'increment');
    expect(onValueChange).toHaveBeenCalledWith(100);
  });

  it('clamps at the minimum on decrement', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Slider value={0} min={0} max={100} step={5} onValueChange={onValueChange} />,
    );
    fireAction(getByRole('adjustable'), 'decrement');
    expect(onValueChange).toHaveBeenCalledWith(0);
  });

  it('does not fire onValueChange when disabled', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(
      <Slider value={30} min={0} max={100} step={5} disabled onValueChange={onValueChange} />,
    );
    fireAction(getByRole('adjustable'), 'increment');
    fireAction(getByRole('adjustable'), 'decrement');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('exposes the disabled accessibility state', () => {
    const { getByRole } = render(
      <Slider value={30} min={0} max={100} disabled onValueChange={jest.fn()} />,
    );
    expect(getByRole('adjustable').props.accessibilityState.disabled).toBe(true);
  });

  it('forwards testID and accessibilityLabel', () => {
    const { getByTestId, getByRole } = render(
      <Slider
        value={30}
        min={0}
        max={100}
        onValueChange={jest.fn()}
        testID="radius-slider"
        accessibilityLabel="Raio de busca"
      />,
    );
    expect(getByTestId('radius-slider')).toBeTruthy();
    expect(getByRole('adjustable').props.accessibilityLabel).toBe('Raio de busca');
  });

  it('maps a mid-range value to the expected fill width and thumb offset (pixels)', () => {
    const { getByTestId } = render(
      <Slider value={50} min={0} max={100} onValueChange={jest.fn()} />,
    );
    // ratio = (50 - 0) / (100 - 0) = 0.5
    const ratio = 0.5;
    expect(flatStyle(getByTestId('slider-fill')).width).toBe(ratio * TRACK_WIDTH); // 84
    expect(flatStyle(getByTestId('slider-thumb')).transform).toEqual([
      { translateX: ratio * (TRACK_WIDTH - THUMB_SIZE) }, // 72
    ]);
  });

  it('clamps an out-of-bounds value so fill and thumb stay at the max position', () => {
    const { getByTestId } = render(
      <Slider value={150} min={0} max={100} onValueChange={jest.fn()} />,
    );
    // ratio = clamp((150 - 0) / (100 - 0), 0, 1) = 1 — cannot overflow the track
    const ratio = 1;
    expect(flatStyle(getByTestId('slider-fill')).width).toBe(ratio * TRACK_WIDTH); // 168
    expect(flatStyle(getByTestId('slider-thumb')).transform).toEqual([
      { translateX: ratio * (TRACK_WIDTH - THUMB_SIZE) }, // 144
    ]);
  });
});
