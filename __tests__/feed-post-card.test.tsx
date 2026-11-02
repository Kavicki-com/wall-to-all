import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import { FeedPostCard } from '../components/feed/FeedPostCard';
import type { FeedPost } from '../lib/services/feedTypes';

interface FakePlayer {
  muted: boolean;
  loop: boolean;
  play: jest.Mock;
  pause: jest.Mock;
}

const videoMock = ExpoVideo as unknown as {
  __getPlayers: () => FakePlayer[];
  __resetMediaMocks: () => void;
};

afterEach(() => videoMock.__resetMediaMocks());

const basePost: FeedPost = {
  id: 'fx-1',
  author: { businessId: 101, name: 'Ana Cabelos', handle: '@anaCabelos', logoUrl: null },
  mediaType: 'video',
  mediaUri: 'https://example.com/v.mp4',
  posterUri: null,
  durationSec: 24,
  caption: 'Legenda',
  category: 'Cabelo',
  linkedService: { serviceId: 1, name: 'Corte feminino', priceCents: 8000, durationMinutes: 60 },
  allowDownloads: false,
  shareWithLinkedClients: true,
  likeCount: 45200,
  likedByMe: false,
  createdAt: '2026-05-12T15:00:00.000Z',
};

function renderCard(overrides: Partial<React.ComponentProps<typeof FeedPostCard>> = {}) {
  const props: React.ComponentProps<typeof FeedPostCard> = {
    post: basePost,
    isActive: false,
    following: false,
    showFollow: true,
    onToggleFollow: jest.fn(),
    onLike: jest.fn(),
    onShare: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<FeedPostCard {...props} />) };
}

describe('FeedPostCard', () => {
  it('vídeo: player mudo em loop, toca só quando ativo', () => {
    const { getByTestId, rerender, props } = renderCard({ isActive: true });
    expect(getByTestId('video-view')).toBeTruthy();
    const [player] = videoMock.__getPlayers();
    expect(player.muted).toBe(true);
    expect(player.loop).toBe(true);
    expect(player.play).toHaveBeenCalled();

    rerender(<FeedPostCard {...props} isActive={false} />);
    expect(player.pause).toHaveBeenCalled();
    expect(videoMock.__getPlayers()).toHaveLength(1);
  });

  it('foto: Image com a mídia e nenhum player', () => {
    const { getByTestId, queryByTestId } = renderCard({
      post: {
        ...basePost,
        mediaType: 'photo',
        mediaUri: 'https://example.com/p.jpg',
        durationSec: null,
      },
    });
    expect(getByTestId('feed-post-photo').props.source).toEqual({
      uri: 'https://example.com/p.jpg',
    });
    expect(queryByTestId('video-view')).toBeNull();
    expect(videoMock.__getPlayers()).toHaveLength(0);
  });

  it('rodapé com handle e meta', () => {
    const { getByText } = renderCard();
    expect(getByText('@anaCabelos')).toBeTruthy();
    expect(getByText('Corte feminino · 12 mai')).toBeTruthy();
  });

  it('botão seguir: oculto, "Seguir" e "Seguindo"', () => {
    expect(renderCard({ showFollow: false }).queryByText('Seguir')).toBeNull();

    const { getByText, props } = renderCard();
    fireEvent.press(getByText('Seguir'));
    expect(props.onToggleFollow).toHaveBeenCalledTimes(1);

    expect(renderCard({ following: true }).getByText('Seguindo')).toBeTruthy();
  });

  it('repassa as ações ao trilho', () => {
    const onSchedule = jest.fn();
    const { getByLabelText, getByText, props } = renderCard({ onSchedule });
    expect(getByText('45,2k')).toBeTruthy();
    fireEvent.press(getByLabelText('Curtir'));
    fireEvent.press(getByLabelText('Agendar'));
    fireEvent.press(getByLabelText('Compartilhar'));
    expect(props.onLike).toHaveBeenCalledTimes(1);
    expect(onSchedule).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledTimes(1);
  });

  it('sem onSchedule não mostra "Agendar"', () => {
    expect(renderCard().queryByText('Agendar')).toBeNull();
  });
});
