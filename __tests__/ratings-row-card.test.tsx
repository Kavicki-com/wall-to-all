/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock e em re-require tardio (não convertível para import) */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import RatingsRowCard from '../components/profile/RatingsRowCard';

jest.mock('../components/ui/SurfaceCard', () => {
  const React = require('react');
  const { View } = require('react-native');

  return function MockSurfaceCard({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return <View>{children}</View>;
  };
});

jest.mock('../lib/icons', () => ({
  IconRatingStar: () => null,
  IconKidStar: () => null,
}));

jest.mock('../components/ui/Icon', () => ({
  Icon: () => null,
}));

jest.mock('../lib/theme', () => ({
  colors: {
    textPrimary: '#111111',
    textSecondary: '#666666',
    brand: '#001144',
    accent: '#ff0033',
  },
}));

describe('RatingsRowCard', () => {
  it('keeps the average price label and value on a single line', () => {
    render(
      <RatingsRowCard
        averageRating={5}
        totalReviews={1}
        priceRange="$$$--"
        onViewReviews={jest.fn()}
      />
    );

    expect(screen.getByText('Preço médio').props.numberOfLines).toBe(1);
    expect(screen.getByText('$$$--').props.numberOfLines).toBe(1);
  });
});
