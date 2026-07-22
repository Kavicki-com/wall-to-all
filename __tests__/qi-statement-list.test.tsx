import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QiStatementList } from '../components/qi/QiStatementList';
import type { QiStatementEntry } from '../lib/services/types';

const pastEntries: QiStatementEntry[] = [
  {
    id: 's1',
    title: 'Agendamento realizado',
    subtitle: 'Carlos Silva',
    date: '2026-04-12T14:30:00.000Z',
    amountCents: 265,
  },
  {
    id: 's2',
    title: 'Agendamento realizado',
    subtitle: 'Anderson Ribeiro',
    date: '2026-03-11T09:00:00.000Z',
    amountCents: 500,
  },
];

describe('QiStatementList', () => {
  it('renderiza um item por lançamento com título e valor formatado', () => {
    render(<QiStatementList entries={pastEntries} />);

    expect(screen.getAllByText('Agendamento realizado')).toHaveLength(2);
    expect(screen.getByText('Carlos Silva')).toBeTruthy();
    expect(screen.getByText('Anderson Ribeiro')).toBeTruthy();

    // BRL usa espaço não separável — casa por regex nos dígitos.
    expect(screen.getByText(/2,65/)).toBeTruthy();
    expect(screen.getByText(/5,00/)).toBeTruthy();
  });

  it('formata datas passadas como dd/MM/yyyy', () => {
    render(<QiStatementList entries={pastEntries} />);

    expect(screen.getByText('12/04/2026')).toBeTruthy();
    expect(screen.getByText('11/03/2026')).toBeTruthy();
  });

  it('quando o lançamento é de hoje, mostra "Hoje, HH:mm"', () => {
    // Constrói uma data de hoje no teste; o componente deriva "hoje" via date-fns.
    const todayEntry: QiStatementEntry = {
      id: 's-today',
      title: 'Agendamento realizado',
      subtitle: 'Maria Souza',
      date: new Date().toISOString(),
      amountCents: 265,
    };

    render(<QiStatementList entries={[todayEntry]} />);

    expect(screen.getByText(/^Hoje, \d{2}:\d{2}$/)).toBeTruthy();
  });
});
