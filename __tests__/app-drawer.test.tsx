import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { AppDrawer, DrawerItem } from '../components/layout/AppDrawer';
import { colors } from '../lib/theme';

// Mock do expo-router seguindo o formato usado pelos testes existentes
// (settings-layout.test.tsx): useRouter retorna um objeto com `push`.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const clientItems: DrawerItem[] = [{ label: 'Carteira' }, { label: 'Quem Indica' }];

describe('AppDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders every item label when visible', () => {
    const { getByText } = render(<AppDrawer visible onClose={jest.fn()} items={clientItems} />);
    expect(getByText('Carteira')).toBeTruthy();
    expect(getByText('Quem Indica')).toBeTruthy();
  });

  it('navigates with router.push(route) and closes when an item with a route is pressed', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <AppDrawer
        visible
        onClose={onClose}
        items={[{ label: 'Carteira', route: '/(client)/wallet' }]}
      />,
    );

    fireEvent.press(getByRole('button', { name: 'Carteira' }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(client)/wallet');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls item.onPress (not router) and closes when an item with onPress is pressed', () => {
    const onClose = jest.fn();
    const onPress = jest.fn();
    const { getByRole } = render(
      <AppDrawer
        visible
        onClose={onClose}
        items={[{ label: 'Carteira', route: '/(client)/wallet', onPress }]}
      />,
    );

    fireEvent.press(getByRole('button', { name: 'Carteira' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop/overlay is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<AppDrawer visible onClose={onClose} items={clientItems} />);

    fireEvent.press(getByTestId('drawer-overlay'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close (X) button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId, getByRole } = render(
      <AppDrawer visible onClose={onClose} items={clientItems} />,
    );

    expect(getByRole('button', { name: 'Fechar' })).toBeTruthy();
    fireEvent.press(getByTestId('drawer-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render item labels when not visible', () => {
    const { queryByText } = render(
      <AppDrawer visible={false} onClose={jest.fn()} items={clientItems} />,
    );
    expect(queryByText('Carteira')).toBeNull();
    expect(queryByText('Quem Indica')).toBeNull();
  });

  it('renders an optional header above the items', () => {
    const { getByText } = render(
      <AppDrawer
        visible
        onClose={jest.fn()}
        items={clientItems}
        header={<Text>Olá, Gabriel</Text>}
      />,
    );
    expect(getByText('Olá, Gabriel')).toBeTruthy();
  });

  it('styles the item label as bold Montserrat in the brand color', () => {
    const { getByText } = render(<AppDrawer visible onClose={jest.fn()} items={clientItems} />);
    const flat = getByText('Carteira').props.style;
    const style = Array.isArray(flat) ? Object.assign({}, ...flat) : flat;
    expect(style.fontFamily).toBe('Montserrat_700Bold');
    expect(style.color).toBe(colors.brand);
  });

  it('forwards testID to the root modal container', () => {
    const { getByTestId } = render(
      <AppDrawer visible onClose={jest.fn()} items={clientItems} testID="app-drawer" />,
    );
    expect(getByTestId('app-drawer')).toBeTruthy();
  });

  it('renders the optional icon and badge of an item', () => {
    const { getByTestId, getByText } = render(
      <AppDrawer
        visible
        onClose={jest.fn()}
        items={[{ label: 'Carteira', icon: <Text testID="drawer-item-icon">i</Text>, badge: 3 }]}
      />,
    );
    expect(getByTestId('drawer-item-icon')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });
});
