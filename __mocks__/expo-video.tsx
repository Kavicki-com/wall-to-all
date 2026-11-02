import React, { useRef } from 'react';
import { View } from 'react-native';

/**
 * Mock de expo-video para o Jest (F6). `useVideoPlayer` cria UM player fake por
 * componente (estável entre renders) e roda o setup uma vez; `play`/`pause` são
 * `jest.fn` e `addListener` guarda os listeners, disparados por `__emit(evento)`
 * (o StoryViewer escuta `playToEnd`). `VideoView` vira uma View com
 * `testID="video-view"`.
 *
 * Helpers só deste mock (importar via `require('expo-video')` com cast):
 * `__getPlayers`, `__resetMediaMocks`.
 */

type Listener = (payload?: unknown) => void;

export interface MockVideoPlayer {
  source: unknown;
  muted: boolean;
  loop: boolean;
  playing: boolean;
  currentTime: number;
  play: jest.Mock;
  pause: jest.Mock;
  replace: jest.Mock;
  release: jest.Mock;
  addListener: jest.Mock;
  __emit: (event: string, payload?: unknown) => void;
}

let players: MockVideoPlayer[] = [];

export function createVideoPlayer(source: unknown): MockVideoPlayer {
  const listeners = new Map<string, Set<Listener>>();
  const player: MockVideoPlayer = {
    source,
    muted: false,
    loop: false,
    playing: false,
    currentTime: 0,
    play: jest.fn(() => {
      player.playing = true;
    }),
    pause: jest.fn(() => {
      player.playing = false;
    }),
    replace: jest.fn((next: unknown) => {
      player.source = next;
    }),
    release: jest.fn(),
    addListener: jest.fn((event: string, listener: Listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(event, set);
      return { remove: () => set.delete(listener) };
    }),
    __emit: (event: string, payload?: unknown) => {
      listeners.get(event)?.forEach((listener) => listener(payload));
    },
  };
  players.push(player);
  return player;
}

export function useVideoPlayer(
  source: unknown,
  setup?: (player: MockVideoPlayer) => void,
): MockVideoPlayer {
  const ref = useRef<MockVideoPlayer | null>(null);
  if (ref.current === null) {
    ref.current = createVideoPlayer(source);
    setup?.(ref.current);
  }
  return ref.current;
}

export function VideoView(props: Record<string, unknown>) {
  return <View testID="video-view" {...props} />;
}

export function __getPlayers(): MockVideoPlayer[] {
  return players;
}

export function __resetMediaMocks(): void {
  players = [];
}
