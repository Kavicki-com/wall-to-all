/**
 * Testes de comportamento do EarningsLineChart (F3 — Carteira/Financeiro, Task 7,
 * node 2602:6429).
 *
 * Card "Faturamento": gráfico de linha/área (react-native-svg) com total e badge
 * de tendência. Componente puramente apresentacional (sem contexto/providers),
 * então usamos o `render` cru do RTL.
 *
 * Obs.: as strings BRL vêm de Intl.NumberFormat, que usa um espaço NÃO-quebrável
 * entre "R$" e o número — por isso as asserções de valor casam por regex nos
 * dígitos, e não pela string literal.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { EarningsLineChart } from '../components/dashboard/EarningsLineChart';
import type { EarningsPoint } from '../components/dashboard/EarningsLineChart';

// ~6 pontos com valueCents crescente; rótulos como dias "1".."30".
const POINTS: EarningsPoint[] = [
  { label: '1', valueCents: 20000 },
  { label: '6', valueCents: 45000 },
  { label: '12', valueCents: 60000 },
  { label: '18', valueCents: 85000 },
  { label: '24', valueCents: 100000 },
  { label: '30', valueCents: 115000 },
];
const TOTAL_CENTS = 425000; // 425000 centavos → R$ 4.250

describe('EarningsLineChart', () => {
  it('mostra o total do período formatado em reais', () => {
    const { getByText } = render(
      <EarningsLineChart points={POINTS} totalCents={TOTAL_CENTS} />,
    );

    // formatReais(Math.round(425000 / 100)) → "R$ 4.250" (nbsp após "R$").
    expect(getByText(/4\.250/)).toBeTruthy();
  });

  it('exibe o badge de tendência quando deltaPct é informado e o oculta quando nulo', () => {
    const withDelta = render(
      <EarningsLineChart points={POINTS} totalCents={TOTAL_CENTS} deltaPct={18} />,
    );
    expect(withDelta.getByText(/18%/)).toBeTruthy();

    const withoutDelta = render(
      <EarningsLineChart points={POINTS} totalCents={TOTAL_CENTS} deltaPct={null} />,
    );
    expect(withoutDelta.queryByText(/%/)).toBeNull();
  });

  it('renderiza os rótulos de primeiro e último ponto no eixo x', () => {
    const { getByText } = render(
      <EarningsLineChart points={POINTS} totalCents={TOTAL_CENTS} />,
    );

    expect(getByText('1')).toBeTruthy();
    expect(getByText('30')).toBeTruthy();
  });

  it('sem pontos mostra o estado vazio e não renderiza a linha do gráfico', () => {
    const { getByText, queryByTestId } = render(
      <EarningsLineChart points={[]} totalCents={0} />,
    );

    expect(getByText('Sem dados no período')).toBeTruthy();
    expect(queryByTestId('earnings-line')).toBeNull();
  });
});
