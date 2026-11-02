import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FeedActionRail } from '../components/feed/FeedActionRail';

function setup(overrides: Partial<React.ComponentProps<typeof FeedActionRail>> = {}) {
  const props = {
    liked: false,
    likeCount: 45200,
    onLike: jest.fn(),
    onShare: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<FeedActionRail {...props} />) };
}

describe('FeedActionRail', () => {
  it('mostra a contagem compacta pt-BR', () => {
    const { getByText } = setup();
    expect(getByText('45,2k')).toBeTruthy();
  });

  it('rótulo de acessibilidade segue o estado da curtida', () => {
    expect(setup().getByLabelText('Curtir')).toBeTruthy();
    expect(setup({ liked: true }).getByLabelText('Descurtir')).toBeTruthy();
  });

  it('toque no coração chama onLike', () => {
    const { getByLabelText, props } = setup();
    fireEvent.press(getByLabelText('Curtir'));
    expect(props.onLike).toHaveBeenCalledTimes(1);
  });

  it('"Agendar" só aparece com onSchedule', () => {
    expect(setup().queryByText('Agendar')).toBeNull();
    const onSchedule = jest.fn();
    const { getByLabelText } = setup({ onSchedule });
    fireEvent.press(getByLabelText('Agendar'));
    expect(onSchedule).toHaveBeenCalledTimes(1);
  });

  it('"Compart." chama onShare', () => {
    const { getByText, getByLabelText, props } = setup();
    expect(getByText('Compart.')).toBeTruthy();
    fireEvent.press(getByLabelText('Compartilhar'));
    expect(props.onShare).toHaveBeenCalledTimes(1);
  });
});
