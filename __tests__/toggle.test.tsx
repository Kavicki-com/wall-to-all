import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Toggle } from '../components/ui/Toggle';

describe('Toggle', () => {
  it('calls onValueChange with the opposite value when pressed', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(<Toggle value={false} onValueChange={onValueChange} />);
    fireEvent.press(getByRole('switch'));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('exposes accessibility state', () => {
    const { getByRole } = render(<Toggle value onValueChange={jest.fn()} />);
    expect(getByRole('switch').props.accessibilityState.checked).toBe(true);
  });

  it('toggles from on to off', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(<Toggle value onValueChange={onValueChange} />);
    fireEvent.press(getByRole('switch'));
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('does not fire onValueChange when disabled', () => {
    const onValueChange = jest.fn();
    const { getByRole } = render(<Toggle value={false} onValueChange={onValueChange} disabled />);
    fireEvent.press(getByRole('switch'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('exposes disabled accessibility state', () => {
    const { getByRole } = render(<Toggle value={false} onValueChange={jest.fn()} disabled />);
    expect(getByRole('switch').props.accessibilityState.disabled).toBe(true);
  });
});
