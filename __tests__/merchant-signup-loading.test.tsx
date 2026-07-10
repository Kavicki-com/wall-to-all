/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock e em re-require tardio (não convertível para import) */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

const mockRouter = {
  replace: jest.fn(),
};

const mockAsyncStorageGetItem = jest.fn();
const mockAsyncStorageRemoveItem = jest.fn();
const mockShowError = jest.fn();
const mockRefreshUserRole = jest.fn();
const mockGetSession = jest.fn();
const mockProfileUpsert = jest.fn();
const mockBusinessSelect = jest.fn();
const mockBusinessSingle = jest.fn();
const mockBusinessUpsert = jest.fn(() => ({
  select: mockBusinessSelect,
}));

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

jest.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    showError: mockShowError,
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
    textPrimary: '#111111',
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

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

      if (table === 'business_profiles') {
        return {
          upsert: mockBusinessUpsert,
        };
      }

      if (table === 'services') {
        return {
          insert: jest.fn(),
        };
      }

      throw new Error(`Unexpected table mock request: ${table}`);
    }),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(() => ({
          data: {
            publicUrl: 'https://example.com/mock-image.jpg',
          },
        })),
      })),
    },
  },
}));

describe('MerchantSignupLoadingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockAsyncStorageGetItem.mockResolvedValue(
      JSON.stringify({
        is_oauth: true,
        full_name: 'Merchant Test',
        email: 'merchant@test.com',
        signup_started_at: '2026-03-17T10:00:00.000Z',
        business_name: 'Oficina Teste',
        category_id: 1,
        description: 'Descricao',
        address: 'Rua A, 123',
        business_time: '08:00-18:00',
        work_days: {},
        accepted_payment_methods: ['pix'],
        services: [],
      })
    );
    mockAsyncStorageRemoveItem.mockResolvedValue(null);
    mockGetSession
      .mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: 'user-1',
              email: 'merchant@test.com',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: 'user-1',
              email: 'merchant@test.com',
            },
          },
        },
      });
    mockProfileUpsert.mockResolvedValue({ error: null });
    mockBusinessSelect.mockReturnValue({
      single: mockBusinessSingle,
    });
    mockBusinessSingle.mockResolvedValue({
      data: { id: 321 },
      error: null,
    });
    mockRefreshUserRole.mockResolvedValue('merchant');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('refreshes the merchant role before navigating to the dashboard', async () => {
    const MerchantSignupLoadingScreen = require('../app/(auth)/merchant-signup-loading').default;

    render(<MerchantSignupLoadingScreen />);

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    await waitFor(() => expect(mockRefreshUserRole).toHaveBeenCalledWith('user-1'));
    expect(mockRefreshUserRole.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouter.replace.mock.invocationCallOrder[0]
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/(merchant)/dashboard');
  });
});
