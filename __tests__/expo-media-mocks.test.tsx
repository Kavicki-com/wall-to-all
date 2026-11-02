import React, { createRef } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import * as ExpoCamera from 'expo-camera';
import * as ExpoVideo from 'expo-video';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { VideoView, useVideoPlayer } from 'expo-video';

// Helpers exportados só pelos mocks de __mocks__/ (não existem nos pacotes reais).
const cameraMock = ExpoCamera as unknown as {
  __setCameraPermission: (granted: boolean) => void;
  __setMicrophonePermission: (granted: boolean) => void;
  __resetMediaMocks: () => void;
};
const videoMock = ExpoVideo as unknown as {
  __resetMediaMocks: () => void;
  __getPlayers: () => FakePlayer[];
};

interface FakePlayer {
  muted: boolean;
  loop: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  addListener: jest.Mock;
  __emit: (event: string, payload?: unknown) => void;
}

interface CameraHandle {
  takePictureAsync: () => Promise<{ uri: string }>;
  recordAsync: () => Promise<{ uri: string }>;
  stopRecording: () => void;
}

afterEach(() => {
  cameraMock.__resetMediaMocks();
  videoMock.__resetMediaMocks();
});

describe('mock de expo-camera', () => {
  it('CameraView renderiza camera-view e o ref expõe foto e gravação', async () => {
    const ref = createRef<CameraHandle>();
    const { getByTestId } = render(<CameraView ref={ref as never} />);
    expect(getByTestId('camera-view')).toBeTruthy();

    await expect(ref.current!.takePictureAsync()).resolves.toEqual({ uri: 'file:///photo.jpg' });

    let resolved: { uri: string } | null = null;
    const recording = ref.current!.recordAsync().then((r) => {
      resolved = r;
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolved).toBeNull();

    ref.current!.stopRecording();
    await recording;
    expect(resolved).toEqual({ uri: 'file:///video.mp4' });
  });

  it('permissões configuráveis e restauradas pelo reset', async () => {
    cameraMock.__setCameraPermission(false);
    cameraMock.__setMicrophonePermission(false);

    let camera: ReturnType<typeof useCameraPermissions> | null = null;
    let mic: ReturnType<typeof useMicrophonePermissions> | null = null;
    const Probe = () => {
      camera = useCameraPermissions();
      mic = useMicrophonePermissions();
      return <Text>probe</Text>;
    };
    render(<Probe />);
    expect(camera![0]).toEqual(expect.objectContaining({ granted: false, canAskAgain: true }));
    expect(mic![0]).toEqual(expect.objectContaining({ granted: false }));

    cameraMock.__setCameraPermission(true);
    await act(async () => {
      await camera![1]();
    });
    expect(camera![0]).toEqual(expect.objectContaining({ granted: true }));

    cameraMock.__setCameraPermission(false);
    cameraMock.__resetMediaMocks();
    let after: ReturnType<typeof useCameraPermissions> | null = null;
    const After = () => {
      after = useCameraPermissions();
      return null;
    };
    render(<After />);
    expect(after![0]).toEqual(expect.objectContaining({ granted: true }));
  });
});

describe('mock de expo-video', () => {
  it('useVideoPlayer roda o setup no player fake e guarda listeners', () => {
    const setup = jest.fn((p: FakePlayer) => {
      p.muted = true;
      p.loop = true;
    });
    let player: FakePlayer | null = null;
    const Probe = () => {
      player = useVideoPlayer('https://example.com/v.mp4', setup as never) as unknown as FakePlayer;
      return <VideoView player={player as never} />;
    };
    const { getByTestId, rerender } = render(<Probe />);
    expect(getByTestId('video-view')).toBeTruthy();
    expect(setup).toHaveBeenCalledTimes(1);
    expect(player!.muted).toBe(true);
    expect(player!.loop).toBe(true);

    rerender(<Probe />);
    expect(setup).toHaveBeenCalledTimes(1);

    player!.play();
    player!.pause();
    expect(player!.play).toHaveBeenCalledTimes(1);
    expect(player!.pause).toHaveBeenCalledTimes(1);

    const onEnd = jest.fn();
    const sub = player!.addListener('playToEnd', onEnd) as { remove: () => void };
    player!.__emit('playToEnd');
    expect(onEnd).toHaveBeenCalledTimes(1);
    sub.remove();
    player!.__emit('playToEnd');
    expect(onEnd).toHaveBeenCalledTimes(1);

    expect(videoMock.__getPlayers()).toContain(player);
    videoMock.__resetMediaMocks();
    expect(videoMock.__getPlayers()).toEqual([]);
  });
});
