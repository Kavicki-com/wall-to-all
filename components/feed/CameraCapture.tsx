import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { formatClock } from '../../lib/feed/format';
import { MAX_VIDEO_SECONDS, type FeedMediaType } from '../../lib/services/feedTypes';

export interface CapturedMedia {
  uri: string;
  type: FeedMediaType;
  /** Segundos inteiros; só para vídeo. */
  duration?: number;
}

export interface CameraCaptureProps {
  onClose: () => void;
  onCaptured: (media: CapturedMedia) => void;
}

type Mode = 'photo' | 'video';

// Figma record-video-post (2501:396): fundo content/dark (= colors.textPrimary),
// câmera 390x610, abas + trilho 280x4, linha de gravação 110 com galeria 48,
// botão 80 e virar 48.
const TRACK_WIDTH = 280;
const SHUTTER_SIZE = 80;
const SIDE_BUTTON_SIZE = 48;

/**
 * Câmera do lojista (F6): foto ou vídeo de até 30 s (para sozinho no limite) e
 * galeria, que recusa vídeo acima de 30 s. Pede câmera ao abrir e microfone
 * antes de gravar. Estado de permissão negada não tem frame no Figma
 * (divergência #8).
 */
export const CameraCapture: React.FC<CameraCaptureProps> = ({ onClose, onCaptured }) => {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const [mode, setMode] = useState<Mode>('video');
  const [facing, setFacing] = useState<CameraType>('back');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const stopRecording = useCallback(() => {
    cameraRef.current?.stopRecording();
  }, []);

  const startRecording = async () => {
    setNotice(null);
    if (!micPermission?.granted) {
      const result = await requestMic();
      if (!result.granted) {
        setNotice('Precisamos do microfone para gravar vídeos.');
        return;
      }
    }
    elapsedRef.current = 0;
    setElapsed(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= MAX_VIDEO_SECONDS) stopRecording();
    }, 1000);
    try {
      const result = await cameraRef.current?.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      clearTimer();
      setRecording(false);
      if (result?.uri) {
        const duration = Math.min(MAX_VIDEO_SECONDS, Math.max(1, elapsedRef.current));
        onCaptured({ uri: result.uri, type: 'video', duration });
      }
    } catch {
      clearTimer();
      setRecording(false);
      setNotice('Não foi possível gravar. Tente novamente.');
    }
  };

  const takePhoto = async () => {
    setNotice(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (photo?.uri) onCaptured({ uri: photo.uri, type: 'photo' });
    } catch {
      setNotice('Não foi possível tirar a foto. Tente novamente.');
    }
  };

  const onShutter = () => {
    if (mode === 'photo') {
      takePhoto();
    } else if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const openGallery = async () => {
    setNotice(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.type === 'video') {
      const seconds = Math.round((asset.duration ?? 0) / 1000);
      if (seconds > MAX_VIDEO_SECONDS) {
        setNotice('Escolha um vídeo de até 30 segundos.');
        return;
      }
      onCaptured({ uri: asset.uri, type: 'video', duration: Math.max(1, seconds) });
    } else {
      onCaptured({ uri: asset.uri, type: 'photo' });
    }
  };

  if (!cameraPermission) return <View style={styles.container} />;

  if (!cameraPermission.granted) {
    return (
      <View style={[styles.container, styles.permission, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={onClose}
          style={[styles.closeButton, styles.permissionClose, { top: insets.top + 8 }]}
        >
          <Icon name="close" size={24} color={colors.contentLight} />
        </Pressable>
        <Text style={styles.permissionText}>Precisamos da câmera para gravar seus vídeos.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Permitir acesso"
          onPress={requestCamera}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>Permitir acesso</Text>
        </Pressable>
      </View>
    );
  }

  const progress = mode === 'video' ? elapsed / MAX_VIDEO_SECONDS : 0;

  return (
    <View style={styles.container}>
      <View style={styles.cameraArea}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          mode={mode === 'photo' ? 'picture' : 'video'}
          facing={facing}
          videoQuality="720p"
        />
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Icon name="close" size={24} color={colors.contentLight} />
          </Pressable>
          {mode === 'video' ? (
            <View style={styles.timerPill}>
              <View style={styles.timerDot} />
              <Text style={styles.timerText}>
                {`${formatClock(elapsed)} / ${formatClock(MAX_VIDEO_SECONDS)}`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.modeArea}>
          <View style={styles.tabs}>
            {(['photo', 'video'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityLabel={m === 'photo' ? 'Foto' : 'Vídeo'}
                accessibilityState={{ selected: mode === m }}
                disabled={recording}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                  {m === 'photo' ? 'Foto' : 'Vídeo'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.min(1, progress) * 100}%` }]} />
          </View>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.recordRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir galeria"
            disabled={recording}
            onPress={openGallery}
            style={styles.galleryButton}
          >
            <Icon name="photo-library" size={24} color={colors.brand} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              mode === 'photo' ? 'Tirar foto' : recording ? 'Parar gravação' : 'Gravar vídeo'
            }
            onPress={onShutter}
            style={styles.shutter}
          >
            <View
              style={[
                styles.shutterInner,
                mode === 'photo' && styles.shutterPhoto,
                recording && styles.shutterRecording,
              ]}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Virar câmera"
            disabled={recording}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={styles.flipButton}
          >
            <Icon name="cameraswitch" size={28} color={colors.contentLight} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.textPrimary,
  },
  cameraArea: {
    flex: 1,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  closeButton: {
    width: SIDE_BUTTON_SIZE,
    height: SIDE_BUTTON_SIZE,
    borderRadius: SIDE_BUTTON_SIZE / 2,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 24,
    backgroundColor: colors.accent,
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.contentLight,
  },
  timerText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
  },
  controls: {
    paddingTop: 32,
    paddingBottom: 32,
    gap: 16,
    alignItems: 'center',
  },
  modeArea: {
    width: TRACK_WIDTH,
    alignItems: 'center',
    gap: 20,
  },
  tabs: {
    flexDirection: 'row',
    gap: 24,
  },
  tabText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.contentLight,
  },
  tabTextActive: {
    fontFamily: 'Montserrat_700Bold',
  },
  track: {
    width: '100%',
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.contentLight,
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  notice: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  recordRow: {
    alignSelf: 'stretch',
    height: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  galleryButton: {
    width: SIDE_BUTTON_SIZE,
    height: SIDE_BUTTON_SIZE,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.contentLight,
    backgroundColor: colors.surfacePrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.contentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  shutterPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.contentLight,
  },
  shutterRecording: {
    borderRadius: 6,
  },
  flipButton: {
    width: SIDE_BUTTON_SIZE,
    height: SIDE_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionClose: {
    position: 'absolute',
    left: 20,
  },
  permissionText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 16,
    color: colors.contentLight,
    textAlign: 'center',
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.accent,
  },
  permissionButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.contentLight,
  },
});
