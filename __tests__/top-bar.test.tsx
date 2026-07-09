import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { TopBar } from '../components/layout/TopBar';
import { colors } from '../lib/theme';

// Inset superior controlado (mesma abordagem de network-context.test.tsx) para
// verificar o padding da área segura de forma determinística.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

const flatStyle = (el: Parameters<typeof fireEvent>[0]) => StyleSheet.flatten(el.props.style);

describe('TopBar', () => {
  it('renders the title as visible text when provided', () => {
    const { getByText } = render(<TopBar title="Aqui e agora" />);
    expect(getByText('Aqui e agora')).toBeTruthy();
  });

  it('does not render title text when no title is provided', () => {
    const { queryByText } = render(<TopBar />);
    expect(queryByText('Aqui e agora')).toBeNull();
  });

  it('renders a back button and calls onBack when it is pressed (via testID)', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<TopBar title="Fila" onBack={onBack} />);
    fireEvent.press(getByTestId('topbar-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('exposes the back button as an accessible "Voltar" button and fires onBack', () => {
    const onBack = jest.fn();
    const { getByRole } = render(<TopBar onBack={onBack} />);
    const backButton = getByRole('button', { name: 'Voltar' });
    fireEvent.press(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not render the back button when onBack is not provided', () => {
    const { queryByTestId } = render(<TopBar title="Sem voltar" />);
    expect(queryByTestId('topbar-back')).toBeNull();
  });

  it('uses the brand (navy) background by default', () => {
    const { getByTestId } = render(<TopBar title="Marca" testID="tb" />);
    expect(flatStyle(getByTestId('tb')).backgroundColor).toBe(colors.brand);
  });

  it('uses the light background on the light variant', () => {
    const { getByTestId } = render(<TopBar title="Claro" variant="light" testID="tb" />);
    expect(flatStyle(getByTestId('tb')).backgroundColor).toBe(colors.surfacePrimaryExtraLight);
  });

  it('renders right actions when provided', () => {
    const { getByText } = render(<TopBar title="Com ação" rightActions={<Text>Editar</Text>} />);
    expect(getByText('Editar')).toBeTruthy();
  });

  it('forwards testID to the root so it is findable via getByTestId', () => {
    const { getByTestId } = render(<TopBar title="ID" testID="my-top-bar" />);
    expect(getByTestId('my-top-bar')).toBeTruthy();
  });

  it('applies the safe-area top inset as paddingTop on the container by default', () => {
    const { getByTestId } = render(<TopBar title="Inset" testID="tb" />);
    expect(flatStyle(getByTestId('tb')).paddingTop).toBe(47);
  });

  it('omits the top inset padding when insetTop is false (modal headers)', () => {
    const { getByTestId } = render(<TopBar title="Modal" insetTop={false} testID="tb" />);
    expect(flatStyle(getByTestId('tb')).paddingTop).toBeUndefined();
  });

  it('uses light foreground (contentLight) for the title on the brand variant', () => {
    const { getByText } = render(<TopBar title="Marca" variant="brand" />);
    expect(flatStyle(getByText('Marca')).color).toBe(colors.contentLight);
  });

  it('uses brand (navy) foreground for the title on the light variant', () => {
    const { getByText } = render(<TopBar title="Claro" variant="light" />);
    expect(flatStyle(getByText('Claro')).color).toBe(colors.brand);
  });
});
