import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RootLayout from '../app/_layout';

const mockReplace = jest.fn();
const mockUseSegments = jest.fn();

jest.mock('@expo-google-fonts/montserrat', () => ({
  useFonts: () => [true],
  Montserrat_400Regular: {},
  Montserrat_700Bold: {},
}));

jest.mock('@expo-google-fonts/roboto', () => ({
  useFonts: () => [true],
  Roboto_400Regular: {},
  Roboto_500Medium: {},
}));

jest.mock('@expo-google-fonts/material-symbols-outlined', () => ({
  useFonts: () => [true],
  MaterialSymbolsOutlined_400Regular: {},
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
  clearInvalidAuthTokens: jest.fn(),
}));

jest.mock('expo-router', () => ({
  __esModule: true,
  Stack: () => null,
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockUseSegments(),
}));

jest.mock('../context/AuthContext', () => {
  const actual = jest.requireActual('../context/AuthContext');
  return {
    ...actual,
    useAuth: jest.fn(),
  };
});

const { useAuth } = jest.requireMock('../context/AuthContext');

describe('MainLayout navegação protegida', () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it.skip('redireciona anônimo para login fora do grupo auth', async () => {
    mockUseSegments.mockReturnValue(['(client)']);
    useAuth.mockReturnValue({
      session: null,
      userRole: null,
      isLoading: false,
      profileError: null,
    });

    render(<RootLayout />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it.skip('redireciona merchant autenticado para dashboard quando em auth', async () => {
    mockUseSegments.mockReturnValue(['(auth)']);
    useAuth.mockReturnValue({
      session: { user: { id: '123' } },
      userRole: 'merchant',
      isLoading: false,
      profileError: null,
    });

    render(<RootLayout />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(merchant)/dashboard');
    });
  });
});

