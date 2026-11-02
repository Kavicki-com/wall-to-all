import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as ExpoVideo from 'expo-video';
import { StoryViewer } from '../components/feed/StoryViewer';
import type { FeedPost, FeedStoryGroup } from '../lib/services/feedTypes';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

interface FakePlayer {
  play: jest.Mock;
  __emit: (event: string, payload?: unknown) => void;
}

const videoMock = ExpoVideo as unknown as {
  __getPlayers: () => FakePlayer[];
  __resetMediaMocks: () => void;
};

const author = { businessId: 102, name: 'Zara Moda', handle: '@zaraModa', logoUrl: null };

function post(id: string, overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id,
    author,
    mediaType: 'photo',
    mediaUri: `https://example.com/${id}.jpg`,
    posterUri: null,
    durationSec: null,
    caption: `Legenda ${id}`,
    category: null,
    linkedService: null,
    allowDownloads: false,
    shareWithLinkedClients: true,
    likeCount: 0,
    likedByMe: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

const photos: FeedStoryGroup = { author, posts: [post('p1'), post('p2')] };

function mediaUri(getByTestId: (id: string) => { props: { source?: { uri: string } } }) {
  return getByTestId('story-photo').props.source?.uri;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  videoMock.__resetMediaMocks();
});

describe('StoryViewer', () => {
  it('fotos avançam a cada 5s e fecham no fim', () => {
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <StoryViewer visible group={photos} onClose={onClose} />,
    );
    expect(mediaUri(getByTestId)).toBe('https://example.com/p1.jpg');
    expect(getByText('@zaraModa')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(mediaUri(getByTestId)).toBe('https://example.com/p2.jpg');
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toque à direita avança, à esquerda volta, fechar chama onClose', () => {
    const onClose = jest.fn();
    const { getByTestId, getByLabelText } = render(
      <StoryViewer visible group={photos} onClose={onClose} />,
    );
    fireEvent.press(getByLabelText('Story anterior'));
    expect(mediaUri(getByTestId)).toBe('https://example.com/p1.jpg');

    fireEvent.press(getByLabelText('Próximo story'));
    expect(mediaUri(getByTestId)).toBe('https://example.com/p2.jpg');

    fireEvent.press(getByLabelText('Story anterior'));
    expect(mediaUri(getByTestId)).toBe('https://example.com/p1.jpg');

    fireEvent.press(getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('vídeo avança no playToEnd e não por tempo', () => {
    const group: FeedStoryGroup = {
      author,
      posts: [
        post('v1', { mediaType: 'video', mediaUri: 'https://example.com/v1.mp4', durationSec: 10 }),
        post('p2'),
      ],
    };
    const { getByTestId, queryByTestId } = render(
      <StoryViewer visible group={group} onClose={jest.fn()} />,
    );
    expect(getByTestId('video-view')).toBeTruthy();
    const [player] = videoMock.__getPlayers();
    expect(player.play).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(20000);
    });
    expect(getByTestId('video-view')).toBeTruthy();

    act(() => {
      player.__emit('playToEnd');
    });
    expect(queryByTestId('video-view')).toBeNull();
    expect(mediaUri(getByTestId)).toBe('https://example.com/p2.jpg');
  });

  it('mostra legenda e omite o bloco quando vazia', () => {
    const { getByText, queryByTestId, rerender } = render(
      <StoryViewer visible group={photos} onClose={jest.fn()} />,
    );
    expect(getByText('Legenda p1')).toBeTruthy();

    rerender(
      <StoryViewer
        visible
        group={{ author, posts: [post('p9', { caption: '' })] }}
        onClose={jest.fn()}
      />,
    );
    expect(queryByTestId('story-caption')).toBeNull();
  });

  it('group null ou invisível não renderiza conteúdo', () => {
    const { queryByTestId, rerender } = render(
      <StoryViewer visible group={null} onClose={jest.fn()} />,
    );
    expect(queryByTestId('story-photo')).toBeNull();
    rerender(<StoryViewer visible={false} group={photos} onClose={jest.fn()} />);
    expect(queryByTestId('story-photo')).toBeNull();
  });
});
