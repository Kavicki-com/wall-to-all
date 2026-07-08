/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock e em re-require tardio (não convertível para import) */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

const mockRouter = {
  replace: jest.fn(),
};

const mockAsyncStorageGetItem = jest.fn();
const mockAsyncStorageRemoveItem = jest.fn();
const mockRefreshUserRole = jest.fn();
const mockGetSession = jest.fn();
const mockProfileUpsert = jest.fn();
const mockClientProfileUpsert = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => mockAsyncStorageGetItem(key),
  removeItem: (key: string) => mockAsyncStorageRemoveItem(key),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    refreshUserRole: mockRefreshUserRole,
  }),
}));

jest.mock('../lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../lib/assets', () => ({
  LogoWallToAll: () => null,
}));

jest.mock('../lib/theme', () => ({
  colors: {
    brand: '#111111',
    textPrimary: '#222222',
    accent: '#ff0000',
  },
}));

jest.mock('../components/layout/ScreenContainer', () => {
  const React = require('react');
  const { View } = require('react-native');

  return function MockScreenContainer({ children }: { children: React.ReactNode }) {
    return <View>{children}</View>;
  };
});

jest.mock('../components/CustomButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    CustomButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    from: jest.fn((table: string) => {
      if (table === 'profiles') {
        return {
          upsert: mockProfileUpsert,
        };
      }

      if (table === 'client_profiles') {
        return {
          upsert: mockClientProfileUpsert,
        };
      }

      throw new Error(`Unexpected table mock request: ${table}`);
    }),
  },
}));

describe('ClientSignupLoadingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockAsyncStorageGetItem.mockResolvedValue(
      JSON.stringify({
        is_oauth: true,
        full_name: 'Client Test',
        email: 'client@test.com',
        signup_started_at: '2026-03-17T10:00:00.000Z',
        address: 'Rua B, 456',
      })
    );
    mockAsyncStorageRemoveItem.mockResolvedValue(null);
    mockGetSession
      .mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: 'user-2',
              email: 'client@test.com',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: 'user-2',
              email: 'client@test.com',
            },
          },
        },
      });
    mockProfileUpsert.mockResolvedValue({ error: null });
    mockClientProfileUpsert.mockResolvedValue({ error: null });
    mockRefreshUserRole.mockResolvedValue('client');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('refreshes the client role before navigating home', async () => {
    const ClientSignupLoadingScreen = require('../app/(auth)/client-signup-loading').default;

    render(<ClientSignupLoadingScreen />);

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    await waitFor(() => expect(mockRefreshUserRole).toHaveBeenCalledWith('user-2'));
    expect(mockRefreshUserRole.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouter.replace.mock.invocationCallOrder[0]
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/(client)/home');
  });
});
