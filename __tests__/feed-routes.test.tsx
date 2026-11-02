import React from 'react';
import { render } from '@testing-library/react-native';
import ClientFeedRoute from '../app/(client)/feed/index';
import MerchantFeedRoute from '../app/(merchant)/feed/index';
import { CLIENT_DRAWER_ITEMS } from '../components/layout/clientDrawerItems';
import {
  MERCHANT_DRAWER_ITEMS,
  MERCHANT_HOME_DRAWER_ITEMS,
} from '../components/layout/merchantDrawerItems';

let mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
}));

const mockScreenProps = jest.fn();
jest.mock('../components/feed/FeedScreen', () => ({
  FeedScreen: (props: unknown) => {
    mockScreenProps(props);
    return null;
  },
}));

beforeEach(() => {
  mockParams = {};
  mockScreenProps.mockClear();
});

describe('rotas de feed', () => {
  it('cliente repassa businessId numérico como initialBusinessId', () => {
    mockParams = { businessId: '102' };
    render(<ClientFeedRoute />);
    expect(mockScreenProps).toHaveBeenLastCalledWith({ role: 'client', initialBusinessId: 102 });
  });

  it.each([[undefined], [''], ['abc'], ['-1']])(
    'cliente ignora businessId inválido (%s)',
    (businessId) => {
      mockParams = { businessId };
      render(<ClientFeedRoute />);
      expect(mockScreenProps).toHaveBeenLastCalledWith({
        role: 'client',
        initialBusinessId: undefined,
      });
    },
  );

  it('lojista renderiza a tela com role merchant', () => {
    render(<MerchantFeedRoute />);
    expect(mockScreenProps).toHaveBeenLastCalledWith({ role: 'merchant' });
  });
});

describe('entradas de menu do feed', () => {
  const labels = (items: { label: string }[]) => items.map((i) => i.label);

  it('cliente: "Feed" depois de "Buscar serviços"', () => {
    const list = labels(CLIENT_DRAWER_ITEMS);
    expect(list[list.indexOf('Buscar serviços') + 1]).toBe('Feed');
    expect(CLIENT_DRAWER_ITEMS.find((i) => i.label === 'Feed')?.route).toBe('/(client)/feed');
  });

  it.each([
    ['MERCHANT_DRAWER_ITEMS', MERCHANT_DRAWER_ITEMS],
    ['MERCHANT_HOME_DRAWER_ITEMS', MERCHANT_HOME_DRAWER_ITEMS],
  ])('lojista (%s): "Feed" depois de "Serviços"', (_name, items) => {
    const list = labels(items);
    expect(list[list.indexOf('Serviços') + 1]).toBe('Feed');
    expect(items.find((i) => i.label === 'Feed')?.route).toBe('/(merchant)/feed');
  });
});
