import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

const profileResponses: Array<{
  data: { user_type: 'client' | 'merchant' | null } | null;
  error: null;
}> = [];

const mockGetSession = jest.fn();
const mockMaybeSingle = jest.fn(() =>
  Promise.resolve(profileResponses.shift() ?? { data: null, error: null })
);
const mockOnAuthStateChange = jest.fn((_callback?: unknown) => ({
  data: {
    subscription: {
      unsubscribe: jest.fn(),
    },
  },
}));
const mockRefreshSession = jest.fn();
const mockSignOut = jest.fn();
const mockShowError = jest.fn();

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  clearInvalidAuthTokens: jest.fn(),
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: unknown) => mockOnAuthStateChange(callback),
      refreshSession: () => mockRefreshSession(),
      signOut: () => mockSignOut(),
    },
    from: jest.fn((table: string) => {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table mock request: ${table}`);
      }

      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: mockMaybeSingle,
          })),
        })),
      };
    }),
  },
}));

jest.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    showError: mockShowError,
  }),
}));

jest.mock('../lib/errorHandler', () => ({
  handleError: jest.fn(() => ({
    userMessage: 'Erro de auth',
  })),
}));

jest.mock('../lib/useDeepLinking', () => ({
  getIsRecoverySession: () => false,
  getIsOAuthSignupSession: () => false,
}));

jest.mock('../lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AuthContext role refresh', () => {
  beforeEach(() => {
    profileResponses.length = 0;
    jest.clearAllMocks();
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('updates the in-memory role after the profile user_type changes', async () => {
    let triggerRefresh: (() => Promise<unknown>) | undefined;

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
          },
        },
      },
      error: null,
    });

    profileResponses.push(
      { data: { user_type: 'client' }, error: null },
      { data: { user_type: 'merchant' }, error: null }
    );

    const Consumer = () => {
      const auth = useAuth() as ReturnType<typeof useAuth> & {
        refreshUserRole?: (userId?: string) => Promise<unknown>;
      };

      triggerRefresh = () => auth.refreshUserRole?.('user-1') ?? Promise.resolve(null);

      return <Text>{auth.userRole ?? 'none'}</Text>;
    };

    const view = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('client')).toBeTruthy());

    await act(async () => {
      await triggerRefresh?.();
    });

    await waitFor(() => expect(screen.getByText('merchant')).toBeTruthy());

    view.unmount();
  });
});
