/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock e em re-require tardio (não convertível para import) */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

const mockScreenContainerProps: Array<{ footer?: React.ReactNode }> = [];
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('../context/ProfileContext', () => ({
  useProfile: () => ({
    loading: false,
    profile: {
      full_name: 'Gabriel Teste',
      created_at: '2025-01-10T00:00:00.000Z',
      avatar_url: null,
    },
  }),
}));

jest.mock('../context/BusinessProfileContext', () => ({
  useBusinessProfile: () => ({
    loading: false,
    businessProfile: {
      business_name: 'Repair AutoCar',
      logo_url: null,
      categories: {
        name: 'Assistência Técnica',
      },
    },
  }),
}));

jest.mock('../components/ui/ToastProvider', () => ({
  useToast: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
    showInfo: jest.fn(),
  }),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock('../lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../components/layout/ScreenContainer', () => {
  const React = require('react');
  const { View } = require('react-native');

  return function MockScreenContainer({
    children,
    footer,
  }: {
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) {
    mockScreenContainerProps.push({ footer });

    return (
      <View>
        <View testID="screen-content">{children}</View>
        {footer ? <View testID="screen-footer">{footer}</View> : null}
      </View>
    );
  };
});

jest.mock('../components/CustomButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    CustomButton: ({ title, onPress, style }: { title: string; onPress: () => void; style?: unknown }) => (
      <Pressable accessibilityRole="button" onPress={onPress} style={style}>
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});

jest.mock('../lib/icons', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Icon = () => <View />;

  return {
    IconAccount: Icon,
    IconAccountCircle: Icon,
    IconLock: Icon,
    IconSupport: Icon,
    IconDocs: Icon,
    IconHelp: Icon,
    IconDelete: Icon,
    IconGroup: Icon,
    IconMetrics: Icon,
  };
});

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: () => null,
}));

describe('settings screens layout', () => {
  beforeEach(() => {
    mockScreenContainerProps.length = 0;
    jest.clearAllMocks();
  });

  it('renders the client logout action through ScreenContainer footer', () => {
    const ClientSettingsScreen = require('../app/(client)/settings/index').default;

    render(<ClientSettingsScreen />);

    expect(screen.getByText('Editar Perfil')).toBeTruthy();
    expect(screen.getByText('Alterar Senha')).toBeTruthy();
    expect(screen.getByText('Excluir Conta')).toBeTruthy();
    expect(screen.getByText('Suporte')).toBeTruthy();
    expect(screen.getByText('Termos de uso')).toBeTruthy();
    expect(screen.getByText('Política de Privacidade')).toBeTruthy();
    expect(screen.getByText('FAQ')).toBeTruthy();
    expect(screen.getByText('Sair')).toBeTruthy();
    expect(mockScreenContainerProps.at(-1)?.footer).toBeTruthy();
  });

  it('renders the merchant logout action through ScreenContainer footer', () => {
    const MerchantSettingsScreen = require('../app/(merchant)/settings/index').default;

    render(<MerchantSettingsScreen />);

    expect(screen.getByText('Editar Perfil')).toBeTruthy();
    expect(screen.getByText('Alterar Senha')).toBeTruthy();
    expect(screen.getByText('Excluir Conta')).toBeTruthy();
    expect(screen.getByText('Suporte')).toBeTruthy();
    expect(screen.getByText('Termos de uso')).toBeTruthy();
    expect(screen.getByText('Política de Privacidade')).toBeTruthy();
    expect(screen.getByText('FAQ')).toBeTruthy();
    expect(screen.getByText('Sair')).toBeTruthy();
    expect(mockScreenContainerProps.at(-1)?.footer).toBeTruthy();
  });
});
