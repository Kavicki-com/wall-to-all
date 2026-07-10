import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatementTimeline } from '../components/wallet/StatementTimeline';
import type { WalletEntry } from '../lib/services/types';

// Fixtures: um crédito de serviço, um crédito de fura-fila e um débito de saque.
const serviceEntry: WalletEntry = {
  id: 'e1',
  kind: 'service',
  title: 'Corte de cabelo masc.',
  subtitle: 'Carlos Silva',
  amountCents: 6500,
  date: '2026-07-01T14:30:00.000Z',
};

const furaFilaEntry: WalletEntry = {
  id: 'e2',
  kind: 'fura_fila',
  title: 'Furou Fila',
  subtitle: 'Taxa de antecipação Fura Fila',
  amountCents: 800,
  date: '2026-07-02T09:15:00.000Z',
};

const withdrawEntry: WalletEntry = {
  id: 'e3',
  kind: 'withdraw',
  title: 'Saque',
  subtitle: '*********-12',
  amountCents: -20000,
  date: '2026-07-03T18:00:00.000Z',
};

const entries: WalletEntry[] = [serviceEntry, furaFilaEntry, withdrawEntry];

describe('StatementTimeline', () => {
  it('renderiza uma linha por lançamento com o título de cada um', () => {
    render(<StatementTimeline entries={entries} emptyMessage="Nenhum lançamento encontrado" />);

    expect(screen.getByText('Corte de cabelo masc.')).toBeTruthy();
    expect(screen.getByText('Furou Fila')).toBeTruthy();
    expect(screen.getByText('Saque')).toBeTruthy();
  });

  it('mostra crédito com "+" e débito com "-" (BRL usa espaço não separável)', () => {
    render(<StatementTimeline entries={entries} emptyMessage="Nenhum lançamento encontrado" />);

    // Regex por causa do espaço não separável entre "R$" e o valor.
    expect(screen.getByText(/\+.*65,00/)).toBeTruthy();
    expect(screen.getByText(/-.*200,00/)).toBeTruthy();
  });

  it('renderiza o ponto colorido de cada tipo de lançamento', () => {
    render(<StatementTimeline entries={entries} emptyMessage="Nenhum lançamento encontrado" />);

    expect(screen.getByTestId('dot-service')).toBeTruthy();
    expect(screen.getByTestId('dot-fura_fila')).toBeTruthy();
    expect(screen.getByTestId('dot-withdraw')).toBeTruthy();
  });

  it('sem lançamentos, exibe a mensagem vazia e nenhum ponto', () => {
    render(<StatementTimeline entries={[]} emptyMessage="Nenhum lançamento encontrado" />);

    expect(screen.getByText('Nenhum lançamento encontrado')).toBeTruthy();
    expect(screen.queryByTestId('dot-service')).toBeNull();
  });
});
