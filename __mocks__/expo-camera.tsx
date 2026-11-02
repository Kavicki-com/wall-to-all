import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View } from 'react-native';

/**
 * Mock de expo-camera para o Jest (F6). O módulo nativo não existe no ambiente
 * de teste; aqui o CameraView vira uma View com `testID="camera-view"` e o ref
 * expõe foto e gravação com resultados fixos.
 *
 * Helpers só deste mock (importar via `require('expo-camera')` com cast):
 * `__setCameraPermission`, `__setMicrophonePermission`, `__resetMediaMocks`.
 */

interface MockPermission {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied';
  expires: 'never';
}

let cameraGranted = true;
let microphoneGranted = true;
let pendingRecording: ((result: { uri: string }) => void) | null = null;

function permission(granted: boolean): MockPermission {
  return { granted, canAskAgain: true, status: granted ? 'granted' : 'denied', expires: 'never' };
}

export function __setCameraPermission(granted: boolean): void {
  cameraGranted = granted;
}

export function __setMicrophonePermission(granted: boolean): void {
  microphoneGranted = granted;
}

export function __resetMediaMocks(): void {
  cameraGranted = true;
  microphoneGranted = true;
  pendingRecording = null;
}

function makePermissionHook(read: () => boolean) {
  return () => {
    const [current, setCurrent] = useState<MockPermission>(() => permission(read()));
    const request = async () => {
      const next = permission(read());
      setCurrent(next);
      return next;
    };
    return [current, request, request] as const;
  };
}

export const useCameraPermissions = makePermissionHook(() => cameraGranted);
export const useMicrophonePermissions = makePermissionHook(() => microphoneGranted);

export const CameraView = forwardRef<unknown, Record<string, unknown>>(
  function MockCameraView(props, ref) {
    useImperativeHandle(ref, () => ({
      takePictureAsync: async () => ({ uri: 'file:///photo.jpg' }),
      recordAsync: () =>
        new Promise<{ uri: string }>((resolve) => {
          pendingRecording = resolve;
        }),
      stopRecording: () => {
        const resolve = pendingRecording;
        pendingRecording = null;
        resolve?.({ uri: 'file:///video.mp4' });
      },
    }));
    return <View testID="camera-view" {...props} />;
  },
);

export default CameraView;
