import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

describe('Smoke test', () => {
  it('renders basic text', () => {
    const { getByText } = render(<Text>hello</Text>);
    expect(getByText('hello')).toBeTruthy();
  });
});

