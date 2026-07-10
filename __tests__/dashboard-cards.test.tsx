/**
 * Testes de comportamento do GoalOverview e do KpiCard (F2 — Dashboards/Home, Task 5).
 *
 * Componentes apresentacionais da home do lojista:
 *  - GoalOverview: card "Visão do mês" (meta vs realizado + barra de progresso).
 *  - KpiCard: cartão de indicador (ícone + rótulo + valor + variação opcional).
 *
 * Ambos são puros (sem contexto/providers), então usamos o `render` cru do RTL.
 */
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { render, fireEvent, within } from '@testing-library/react-native';
import { GoalOverview } from '../components/dashboard/GoalOverview';
import { KpiCard } from '../components/dashboard/KpiCard';
import type { MonthOverview } from '../lib/dashboardMetrics';

describe('GoalOverview', () => {
  it('mostra previsão/realizado/faltam formatados e a legenda "em dia" com a barra em 71%', () => {
    const overview: MonthOverview = {
      forecast: 6000,
      realized: 4250,
      remaining: 1750,
      pct: 71,
      onTrack: true,
    };
    const { getByText, getByTestId } = render(<GoalOverview overview={overview} />);

    expect(getByText('R$ 6.000')).toBeTruthy();
    expect(getByText('R$ 4.250')).toBeTruthy();
    expect(getByText('R$ 1.750')).toBeTruthy();

    const caption = within(getByTestId('goal-caption'));
    expect(caption.getByText(/71% da meta/)).toBeTruthy();
    expect(caption.getByText(/você está em dia!/)).toBeTruthy();

    expect(
      StyleSheet.flatten(getByTestId('goal-progress-fill').props.style),
    ).toEqual(expect.objectContaining({ width: '71%' }));
  });

  it('usa a variante de alerta ("corra atrás!") quando não está no ritmo', () => {
    const overview: MonthOverview = {
      forecast: 6000,
      realized: 1200,
      remaining: 4800,
      pct: 20,
      onTrack: false,
    };
    const { getByTestId } = render(<GoalOverview overview={overview} />);

    const caption = within(getByTestId('goal-caption'));
    expect(caption.getByText(/20% da meta/)).toBeTruthy();
    expect(caption.getByText(/corra atrás!/)).toBeTruthy();
  });

  it('sem histórico (overview null) mostra o placeholder e não renderiza a barra', () => {
    const { getByText, queryByTestId } = render(<GoalOverview overview={null} />);

    expect(getByText('Sem histórico do mês anterior ainda')).toBeTruthy();
    expect(queryByTestId('goal-progress-fill')).toBeNull();
  });

  it('dispara onPress ao tocar no cabeçalho "Visão do mês"', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <GoalOverview overview={null} onPress={onPress} />,
    );

    fireEvent.press(getByTestId('goal-overview-header'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('KpiCard', () => {
  it('renderiza o rótulo e o valor', () => {
    const { getByText } = render(
      <KpiCard icon={<Text>i</Text>} label="Agendamentos" value="24" delta={null} />,
    );

    expect(getByText('Agendamentos')).toBeTruthy();
    expect(getByText('24')).toBeTruthy();
  });

  it('mostra o badge de variação quando delta != null e o omite quando null', () => {
    const { getByTestId, getByText, rerender, queryByTestId } = render(
      <KpiCard
        icon={<Text>i</Text>}
        label="Agendamentos"
        value="24"
        delta={{ text: '+12%', up: true }}
      />,
    );

    expect(getByTestId('kpi-delta')).toBeTruthy();
    expect(getByText('+12%')).toBeTruthy();

    rerender(
      <KpiCard icon={<Text>i</Text>} label="Agendamentos" value="24" delta={null} />,
    );
    expect(queryByTestId('kpi-delta')).toBeNull();
  });
});
