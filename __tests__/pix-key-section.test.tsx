import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PixKeySection } from '../components/wallet/PixKeySection';
import type { PixKey } from '../lib/services/types';

// Fixtures: uma chave CPF e uma chave e-mail, com valores já mascarados.
const cpfKey: PixKey = {
  id: 'k1',
  type: 'cpf',
  maskedValue: '*********-12',
  createdAt: '2026-07-01T10:00:00.000Z',
};

const emailKey: PixKey = {
  id: 'k2',
  type: 'email',
  maskedValue: 'a***@gmail.com',
  createdAt: '2026-07-02T10:00:00.000Z',
};

describe('PixKeySection', () => {
  it('renderiza um cartão por chave com o rótulo pt-BR do tipo e o valor mascarado', () => {
    render(<PixKeySection keys={[cpfKey, emailKey]} onAddPress={jest.fn()} />);

    // Um cartão por chave, identificado pelo testID derivado do id.
    expect(screen.getByTestId('pix-key-k1')).toBeTruthy();
    expect(screen.getByTestId('pix-key-k2')).toBeTruthy();

    // Rótulos traduzidos e valores mascarados exibidos.
    expect(screen.getByText('CPF')).toBeTruthy();
    expect(screen.getByText('E-mail')).toBeTruthy();
    expect(screen.getByText('*********-12')).toBeTruthy();
    expect(screen.getByText('a***@gmail.com')).toBeTruthy();
  });

  it('sem chaves, não renderiza nenhum cartão mas mantém o botão de adicionar', () => {
    render(<PixKeySection keys={[]} onAddPress={jest.fn()} />);

    expect(screen.queryByTestId('pix-key-k1')).toBeNull();
    expect(screen.queryByTestId('pix-key-k2')).toBeNull();
    expect(screen.getByTestId('btn-add-pix')).toBeTruthy();
  });

  it('chama onAddPress ao pressionar o botão de adicionar', () => {
    const onAddPress = jest.fn();
    render(<PixKeySection keys={[]} onAddPress={onAddPress} />);

    fireEvent.press(screen.getByTestId('btn-add-pix'));
    expect(onAddPress).toHaveBeenCalledTimes(1);
  });
});
