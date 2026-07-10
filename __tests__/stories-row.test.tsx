/**
 * Testes de comportamento do StoriesRow (F2 — Dashboards/Home, Task 3).
 *
 * Linha horizontal de "stories" (avatares circulares dos negócios em destaque)
 * na home do cliente. Componente puramente apresentacional — sem contexto, então
 * usamos o `render` puro do RTL. Cobrem: renderização dos nomes, um pressable por
 * loja, fallback de iniciais quando não há `logoUrl`, disparo do `onPressStore`
 * com a loja tocada e o estado vazio (não renderiza nada).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StoriesRow, type StoriesRowStore } from '../components/home/StoriesRow';

// Fixture: 3 lojas, uma sem logo (para exercitar o fallback de iniciais).
const stores: StoriesRowStore[] = [
  { id: 1, name: 'Zara Moda', logoUrl: 'https://example.com/zara.png' },
  { id: 2, name: 'Bella Boutique', logoUrl: null },
  { id: 3, name: 'Varejo Silva', logoUrl: 'https://example.com/varejo.png' },
];

describe('StoriesRow', () => {
  it('renderiza o nome de cada loja', () => {
    const { getByText } = render(<StoriesRow stores={stores} />);

    expect(getByText('Zara Moda')).toBeTruthy();
    expect(getByText('Bella Boutique')).toBeTruthy();
    expect(getByText('Varejo Silva')).toBeTruthy();
  });

  it('renderiza um pressable por loja', () => {
    const { getByTestId } = render(<StoriesRow stores={stores} />);

    expect(getByTestId('story-1')).toBeTruthy();
    expect(getByTestId('story-2')).toBeTruthy();
    expect(getByTestId('story-3')).toBeTruthy();
  });

  it('mostra as iniciais quando a loja não tem logo e não as mostra quando tem', () => {
    const { getByText, queryByText } = render(<StoriesRow stores={stores} />);

    // Bella Boutique não tem logo → iniciais "BB".
    expect(getByText('BB')).toBeTruthy();
    // Zara Moda tem logo (foto via Image) → sem texto de iniciais "ZM".
    expect(queryByText('ZM')).toBeNull();
  });

  it('dispara onPressStore com a loja tocada', () => {
    const onPressStore = jest.fn();
    const { getByTestId } = render(
      <StoriesRow stores={stores} onPressStore={onPressStore} />,
    );

    fireEvent.press(getByTestId('story-2'));

    expect(onPressStore).toHaveBeenCalledTimes(1);
    expect(onPressStore).toHaveBeenCalledWith(stores[1]);
  });

  it('não renderiza nada quando a lista está vazia', () => {
    const { toJSON } = render(<StoriesRow stores={[]} />);

    expect(toJSON()).toBeNull();
  });
});
