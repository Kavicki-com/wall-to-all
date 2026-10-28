import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QiCodeCard } from '../components/qi/QiCodeCard';

describe('QiCodeCard', () => {
  it('renderiza o rótulo, o código e o subtítulo recebido', () => {
    render(
      <QiCodeCard
        code="QI-HOG23-3892"
        subtitle="Convide amigos e receba cashback no PIX"
        onShare={jest.fn()}
      />,
    );

    expect(screen.getByText('Código')).toBeTruthy();
    expect(screen.getByText('QI-HOG23-3892')).toBeTruthy();
    expect(screen.getByText('Convide amigos e receba cashback no PIX')).toBeTruthy();
  });

  it('dispara onShare ao tocar no ícone de compartilhar', () => {
    const onShare = jest.fn();
    render(
      <QiCodeCard
        code="QI-HOG23-3892"
        subtitle="Convide amigos e ganhe 50% sobre as mensalidades"
        onShare={onShare}
      />,
    );

    fireEvent.press(screen.getByTestId('qi-code-share'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
