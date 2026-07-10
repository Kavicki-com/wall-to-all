import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from './test-utils';

// expo-router é mockado no escopo do módulo (o Jest iça o jest.mock acima dos
// imports). `mockPush` (prefixo `mock` exigido pelo hoisting) captura a navegação.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import MapSearchScreen from '../app/(client)/aqui-agora/index';
import { categoryIcon } from '../components/aqui-agora/ResultsSheet';
import { formatDistance } from '../lib/formatters';

describe('MapSearchScreen (aqui e agora — map search)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the map and lists nearby merchants in the results sheet', async () => {
    const { getByTestId, findByText } = renderWithProviders(<MapSearchScreen />);
    expect(getByTestId('map-view')).toBeTruthy();
    await findByText(/Barbearia/); // fixture merchant "Barbearia do Zé"
  });

  it('navigates to merchant profile when a result is pressed', async () => {
    const { findByText } = renderWithProviders(<MapSearchScreen />);
    fireEvent.press(await findByText(/Barbearia/));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/aqui-agora/merchant/'));
  });

  it('filters results by search text', async () => {
    const { getByPlaceholderText, queryByText, findByText } = renderWithProviders(
      <MapSearchScreen />,
    );
    await findByText(/Barbearia/);
    fireEvent.changeText(getByPlaceholderText(/procurar/i), 'pizzaria-inexistente');
    await waitFor(() => expect(queryByText(/Barbearia/)).toBeNull());
  });
});

describe('ResultsSheet helpers', () => {
  it('formatDistance renders metres below 1 km', () => {
    expect(formatDistance(0.8)).toBe('800 m');
    expect(formatDistance(0.3)).toBe('300 m');
  });

  it('formatDistance renders km with a comma decimal at/above 1 km', () => {
    expect(formatDistance(1.2)).toBe('1,2 km');
    expect(formatDistance(2)).toBe('2,0 km');
  });

  it('categoryIcon maps known categories case-insensitively', () => {
    expect(categoryIcon('Barbearia')).toBe('content-cut');
    expect(categoryIcon('CAFETERIA')).toBe('local-cafe');
  });

  it('categoryIcon falls back to storefront for unknown categories', () => {
    expect(categoryIcon('Floricultura')).toBe('storefront');
  });
});
