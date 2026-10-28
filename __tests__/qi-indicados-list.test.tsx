import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QiIndicadosList } from '../components/qi/QiIndicadosList';
import type { QiIndicacao } from '../lib/services/types';

// Cria uma indicação com defaults sensatos; sobrescreve o necessário por teste.
function makeIndicacao(overrides: Partial<QiIndicacao> = {}): QiIndicacao {
  return {
    id: 'i1',
    name: 'Lucas Almeida',
    avatarUrl: 'https://example.com/lucas.jpg',
    earnedCents: 1050,
    status: 'active',
    indicatedAt: '2026-02-12T10:00:00.000Z',
    firstAppointmentAt: '2026-02-15T10:00:00.000Z',
    lastActivityAt: '2026-07-20T10:00:00.000Z',
    appointmentsCount: 6,
    ...overrides,
  };
}

const items: QiIndicacao[] = [
  makeIndicacao({ id: 'i1', name: 'Lucas Almeida', earnedCents: 1050 }),
  makeIndicacao({ id: 'i2', name: 'Rafael Pereira', earnedCents: 730 }),
];

const noop = () => {};

describe('QiIndicadosList', () => {
  it('renderiza uma linha por indicação com nome e valor ganho formatado', () => {
    render(
      <QiIndicadosList
        items={items}
        page={1}
        totalPages={1}
        emptyMessage="Nenhum indicado ainda"
        onPressItem={noop}
        onPageChange={noop}
      />,
    );

    expect(screen.getByText('Lucas Almeida')).toBeTruthy();
    expect(screen.getByText('Rafael Pereira')).toBeTruthy();

    // BRL usa espaço não separável — casa por regex nos dígitos.
    expect(screen.getByText(/10,50/)).toBeTruthy();
    expect(screen.getByText(/7,30/)).toBeTruthy();

    // O rótulo "Você ganhou" aparece uma vez por linha.
    expect(screen.getAllByText('Você ganhou')).toHaveLength(2);
  });

  it('quando não há avatar, mostra as iniciais do nome no círculo', () => {
    render(
      <QiIndicadosList
        items={[makeIndicacao({ id: 'i1', name: 'João Pedro', avatarUrl: null })]}
        page={1}
        totalPages={1}
        emptyMessage="Nenhum indicado ainda"
        onPressItem={noop}
        onPageChange={noop}
      />,
    );

    expect(screen.getByText('JP')).toBeTruthy();
  });

  it('tocar em uma linha chama onPressItem com o id do item', () => {
    const onPressItem = jest.fn();
    render(
      <QiIndicadosList
        items={items}
        page={1}
        totalPages={1}
        emptyMessage="Nenhum indicado ainda"
        onPressItem={onPressItem}
        onPageChange={noop}
      />,
    );

    fireEvent.press(screen.getByTestId('qi-indicado-i2'));
    expect(onPressItem).toHaveBeenCalledWith('i2');
  });

  it('lista vazia mostra a mensagem e não renderiza a paginação', () => {
    render(
      <QiIndicadosList
        items={[]}
        page={1}
        totalPages={3}
        emptyMessage="Nenhum indicado ainda"
        onPressItem={noop}
        onPageChange={noop}
      />,
    );

    expect(screen.getByText('Nenhum indicado ainda')).toBeTruthy();
    expect(screen.queryByTestId('qi-pagination')).toBeNull();
  });

  it('com uma única página não renderiza a paginação', () => {
    render(
      <QiIndicadosList
        items={items}
        page={1}
        totalPages={1}
        emptyMessage="Nenhum indicado ainda"
        onPressItem={noop}
        onPageChange={noop}
      />,
    );

    expect(screen.queryByTestId('qi-pagination')).toBeNull();
  });

  it('renderiza os números de página e destaca a página ativa', () => {
    render(
      <QiIndicadosList
        items={items}
        page={2}
        totalPages={3}
        emptyMessage="Nenhum indicado ainda"
        onPressItem={noop}
        onPageChange={noop}
      />,
    );

    expect(screen.getByTestId('qi-pagination')).toBeTruthy();
    expect(screen.getByTestId('qi-page-1')).toBeTruthy();
    expect(screen.getByTestId('qi-page-2')).toBeTruthy();
    expect(screen.getByTestId('qi-page-3')).toBeTruthy();

    // A página 2 (ativa) está marcada como selecionada; as demais, não.
    expect(screen.getByTestId('qi-page-2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('qi-page-1').props.accessibilityState.selected).toBe(false);
  });

  it('tocar em outro número de página chama onPageChange com aquela página', () => {
    const onPageChange = jest.fn();
    render(
      <QiIndicadosList
        items={items}
        page={1}
        totalPages={3}
        emptyMessage="Nenhum indicado ainda"
        onPressItem={noop}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.press(screen.getByTestId('qi-page-3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
