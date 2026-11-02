import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as ExpoCamera from 'expo-camera';
import RecordRoute from '../app/(merchant)/feed/record';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));

const mockLaunch = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunch(...args),
}));

const cameraMock = ExpoCamera as unknown as {
  __setCameraPermission: (granted: boolean) => void;
  __setMicrophonePermission: (granted: boolean) => void;
  __resetMediaMocks: () => void;
};

const PREVIEW = '/(merchant)/feed/preview';

async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(label));
  });
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockPush.mockClear();
  mockBack.mockClear();
  mockLaunch.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
  cameraMock.__resetMediaMocks();
});

describe('gravação do feed (lojista)', () => {
  it('permissão negada mostra o pedido e não a câmera', async () => {
    cameraMock.__setCameraPermission(false);
    render(<RecordRoute />);
    expect(screen.getByText('Precisamos da câmera para gravar seus vídeos.')).toBeTruthy();
    expect(screen.queryByTestId('camera-view')).toBeNull();

    cameraMock.__setCameraPermission(true);
    await press('Permitir acesso');
    expect(screen.getByTestId('camera-view')).toBeTruthy();
  });

  it('começa em "Vídeo" e "Foto" troca o modo', async () => {
    render(<RecordRoute />);
    expect(screen.getByTestId('camera-view').props.mode).toBe('video');
    await press('Foto');
    expect(screen.getByTestId('camera-view').props.mode).toBe('picture');
  });

  it('foto: captura e abre o preview', async () => {
    render(<RecordRoute />);
    await press('Foto');
    await press('Tirar foto');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: PREVIEW,
      params: { uri: 'file:///photo.jpg', type: 'photo' },
    });
  });

  it('vídeo: timer conta e parar abre o preview com a duração', async () => {
    render(<RecordRoute />);
    expect(screen.getByText('00:00 / 00:30')).toBeTruthy();
    await press('Gravar vídeo');
    await advance(3000);
    expect(screen.getByText('00:03 / 00:30')).toBeTruthy();

    await press('Parar gravação');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: PREVIEW,
      params: { uri: 'file:///video.mp4', type: 'video', duration: '3' },
    });
  });

  it('sem microfone não grava', async () => {
    cameraMock.__setMicrophonePermission(false);
    render(<RecordRoute />);
    await press('Gravar vídeo');
    await advance(3000);
    expect(screen.getByText('00:00 / 00:30')).toBeTruthy();
    expect(screen.getByText('Precisamos do microfone para gravar vídeos.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('para sozinho aos 30 s', async () => {
    render(<RecordRoute />);
    await press('Gravar vídeo');
    await advance(30000);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: PREVIEW,
      params: { uri: 'file:///video.mp4', type: 'video', duration: '30' },
    });
  });

  it('galeria: aceita foto e vídeo curto, recusa vídeo longo, ignora cancelado', async () => {
    render(<RecordRoute />);

    mockLaunch.mockResolvedValueOnce({ canceled: true, assets: null });
    await press('Abrir galeria');
    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images', 'videos'] }),
    );
    expect(mockPush).not.toHaveBeenCalled();

    mockLaunch.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///long.mp4', type: 'video', duration: 45000 }],
    });
    await press('Abrir galeria');
    expect(screen.getByText('Escolha um vídeo de até 30 segundos.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();

    mockLaunch.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///short.mp4', type: 'video', duration: 12000 }],
    });
    await press('Abrir galeria');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: PREVIEW,
      params: { uri: 'file:///short.mp4', type: 'video', duration: '12' },
    });

    mockLaunch.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///pic.jpg', type: 'image', duration: null }],
    });
    await press('Abrir galeria');
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: PREVIEW,
      params: { uri: 'file:///pic.jpg', type: 'photo' },
    });
  });

  it('virar alterna a câmera e fechar volta', async () => {
    render(<RecordRoute />);
    expect(screen.getByTestId('camera-view').props.facing).toBe('back');
    await press('Virar câmera');
    expect(screen.getByTestId('camera-view').props.facing).toBe('front');
    await press('Fechar');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
