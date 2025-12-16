import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

jest.mock('../lib/supabase', () => {
  const mockUnsubscribe = jest.fn();
  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: jest.fn().mockReturnValue({
          unsubscribe: mockUnsubscribe,
        }),
        signOut: jest.fn(),
      },
    },
    clearInvalidAuthTokens: jest.fn(),
  };
});

const Consumer = () => {
  const { session, isLoading, userRole } = useAuth();
  return <Text>{`session:${!!session}-loading:${isLoading}-role:${userRole}`}</Text>;
};

describe('AuthContext', () => {
  it('renderiza com sessão nula sem falhar', async () => {
    const { getByText } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByText(/session:false/)).toBeTruthy();
    });
  });
});

