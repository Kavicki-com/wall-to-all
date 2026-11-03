/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock (não convertível para import) */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ProfileStampsRow from '../components/profile/ProfileStampsRow';
import type { ProfileStamp } from '../lib/services/profileTypes';

// A arte dos selos é SVG (react-native-svg-transformer), que o jest-expo trata
// como asset. Troca pelos componentes nulos, mantendo o nome para asserção.
jest.mock('../components/profile/stampArt', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const art = (name: string) => () => ReactMock.createElement(View, { testID: `art-${name}` });
  return {
    STAMP_ART: {
      five_stars: { active: art('five-active'), disabled: art('five-disabled'), aspect: 158 / 148 },
      full_schedule: { active: art('full-active'), disabled: art('full-disabled'), aspect: 1 },
    },
  };
});

const stamps: ProfileStamp[] = [
  { id: 'five_stars', label: '5 estrelas', earned: true },
  { id: 'full_schedule', label: 'Agenda cheia', earned: false },
];

describe('ProfileStampsRow', () => {
  it('renders the stamps in the received order', () => {
    render(<ProfileStampsRow stamps={stamps} />);
    const ids = screen.getAllByTestId(/^stamp-/).map((node) => node.props.testID);
    expect(ids).toEqual(['stamp-five_stars-active', 'stamp-full_schedule-disabled']);
  });

  it('labels each stamp with its name and state', () => {
    render(<ProfileStampsRow stamps={stamps} />);
    expect(screen.getByLabelText('Selo 5 estrelas, conquistado')).toBeTruthy();
    expect(screen.getByLabelText('Selo Agenda cheia, não conquistado')).toBeTruthy();
  });

  it('uses the active or disabled art according to earned', () => {
    render(<ProfileStampsRow stamps={stamps} />);
    expect(screen.getByTestId('art-five-active')).toBeTruthy();
    expect(screen.getByTestId('art-full-disabled')).toBeTruthy();
    expect(screen.queryByTestId('art-five-disabled')).toBeNull();
  });

  it('renders nothing for an empty list', () => {
    const { toJSON } = render(<ProfileStampsRow stamps={[]} />);
    expect(toJSON()).toBeNull();
  });
});
