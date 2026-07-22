import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QiEarningsCard } from '../components/qi/QiEarningsCard';
import type { QiSummary } from '../lib/services/types';

// Resumo "completo" (estado com indicações), espelha o Figma QI-merchant-complete.
const summary: QiSummary = {
  balanceCents: 7409,
  totalEarnedCents: 4500,
  indicadosCount: 12,
  bonusCount: 8,
  nextLevel: { name: 'Ouro', target: 30 },
};

describe('QiEarningsCard', () => {
  it('renderiza título, chip decorativo e os três indicadores a partir dos dados', () => {
    render(<QiEarningsCard summary={summary} />);

    expect(screen.getByText('Ganhos por indicação')).toBeTruthy();
    expect(screen.getByText('Top Indicações')).toBeTruthy();

    // Rótulos dos três indicadores.
    expect(screen.getByText('Lucro total')).toBeTruthy();
    expect(screen.getByText('Indicados')).toBeTruthy();
    expect(screen.getByText('Bônus')).toBeTruthy();

    // Valores: BRL usa espaço não separável — casa por regex nos dígitos.
    expect(screen.getByText(/45,00/)).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('mostra a legenda do próximo nível com meta e nome', () => {
    render(<QiEarningsCard summary={summary} />);

    expect(screen.getByText(/Indique 30 amigos para liberar nível/)).toBeTruthy();
    expect(screen.getByText('Ouro')).toBeTruthy();
    expect(screen.getByTestId('qi-progress-bar')).toBeTruthy();
  });

  it('sem próximo nível (nível máximo) não renderiza legenda nem barra de progresso', () => {
    render(<QiEarningsCard summary={{ ...summary, nextLevel: null }} />);

    expect(screen.queryByText(/liberar nível/)).toBeNull();
    expect(screen.queryByTestId('qi-progress-bar')).toBeNull();
  });

  it('resumo zerado (estado em branco) renderiza os zeros sem quebrar', () => {
    const zeroed: QiSummary = {
      balanceCents: 0,
      totalEarnedCents: 0,
      indicadosCount: 0,
      bonusCount: 0,
      nextLevel: { name: 'Bronze', target: 5 },
    };

    render(<QiEarningsCard summary={zeroed} />);

    expect(screen.getByText(/0,00/)).toBeTruthy();
    // Indicados = 0 e Bônus = 0.
    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.getByText(/Indique 5 amigos para liberar nível/)).toBeTruthy();
    expect(screen.getByText('Bronze')).toBeTruthy();
  });

  it('limita a barra em 100% quando os indicados excedem a meta', () => {
    render(
      <QiEarningsCard summary={{ ...summary, indicadosCount: 45, nextLevel: { name: 'Ouro', target: 30 } }} />,
    );

    // 45/30 = 1,5 → clampado em 1 → largura "100%".
    expect(screen.getByTestId('qi-progress-fill').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: '100%' })]),
    );
  });

  it('meta <= 0 não quebra: barra fica em 0%', () => {
    render(
      <QiEarningsCard summary={{ ...summary, indicadosCount: 3, nextLevel: { name: 'Bronze', target: 0 } }} />,
    );

    // target 0 → guarda evita divisão por zero → largura "0%".
    expect(screen.getByTestId('qi-progress-fill').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: '0%' })]),
    );
  });
});
