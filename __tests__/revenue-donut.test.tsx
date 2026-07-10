/**
 * Testes de comportamento do RevenueDonut (F2 — Dashboards/Home, Task 6, node 2478:200).
 *
 * Card "Receita por serviço": donut de composição (react-native-svg) + legenda.
 * Componente puramente apresentacional (sem contexto/providers), então usamos o
 * `render` cru do RTL.
 *
 * Obs.: as strings BRL vêm de Intl.NumberFormat, que usa um espaço NÃO-quebrável
 * entre "R$" e o número — por isso as asserções de valor casam por regex nos
 * dígitos, e não pela string literal.
 */
import React from 'react';
import { render, within } from '@testing-library/react-native';
import { RevenueDonut } from '../components/dashboard/RevenueDonut';
import type { RevenueSegment } from '../lib/dashboardMetrics';

const SEGMENTS: RevenueSegment[] = [
  { label: 'Corte feminino', amount: 1912, pct: 45 },
  { label: 'Corte masculino', amount: 1062, pct: 25 },
  { label: 'Escovas', amount: 850, pct: 20 },
  { label: 'Outros', amount: 425, pct: 10 },
];
const TOTAL = 4250;

describe('RevenueDonut', () => {
  it('renderiza uma linha de legenda por segmento, com rótulo, % e valor', () => {
    const { getByTestId } = render(
      <RevenueDonut total={TOTAL} segments={SEGMENTS} />,
    );

    // Uma linha por segmento.
    expect(getByTestId('donut-legend-0')).toBeTruthy();
    expect(getByTestId('donut-legend-1')).toBeTruthy();
    expect(getByTestId('donut-legend-2')).toBeTruthy();
    expect(getByTestId('donut-legend-3')).toBeTruthy();

    // A primeira linha carrega rótulo, participação e valor formatado.
    const first = within(getByTestId('donut-legend-0'));
    expect(first.getByText('Corte feminino')).toBeTruthy();
    expect(first.getByText(/45%/)).toBeTruthy();
    expect(first.getByText(/1\.912/)).toBeTruthy();
  });

  it('mostra o total no centro do donut', () => {
    const { getByText } = render(
      <RevenueDonut total={TOTAL} segments={SEGMENTS} />,
    );

    expect(getByText('Total')).toBeTruthy();
    expect(getByText(/4\.250/)).toBeTruthy();
  });

  it('desenha um arco (segment) por segmento', () => {
    const { getByTestId } = render(
      <RevenueDonut total={TOTAL} segments={SEGMENTS} />,
    );

    expect(getByTestId('donut-segment-0')).toBeTruthy();
    expect(getByTestId('donut-segment-1')).toBeTruthy();
    expect(getByTestId('donut-segment-2')).toBeTruthy();
    expect(getByTestId('donut-segment-3')).toBeTruthy();
  });

  it('sem receita mostra o estado vazio e não renderiza donut/legenda', () => {
    const { getByText, queryByTestId } = render(
      <RevenueDonut total={0} segments={[]} />,
    );

    expect(getByText('Sem receita nos últimos 30 dias')).toBeTruthy();
    expect(queryByTestId('donut-legend-0')).toBeNull();
    expect(queryByTestId('donut-segment-0')).toBeNull();
  });
});
