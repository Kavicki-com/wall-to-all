import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Slider } from '../components/ui/Slider';

const fireAction = (el: Parameters<typeof fireEvent>[0], actionName: string) =>
  fireEvent(el, 'accessibilityAction', { nativeEvent: { actionName } });

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
});
