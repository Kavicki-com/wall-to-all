import React from 'react';
import { Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraCapture, type CapturedMedia } from '../../../components/feed/CameraCapture';

/**
 * Câmera do feed do lojista (F6), em Modal para cobrir a tab bar (decisão
 * #12). Captura pronta vai para o preview com `uri`, `type` e `duration`.
 */
export default function MerchantFeedRecordRoute() {
  const router = useRouter();

  const handleCaptured = ({ uri, type, duration }: CapturedMedia) => {
    router.push({
      pathname: '/(merchant)/feed/preview',
      params: type === 'video' ? { uri, type, duration: String(duration) } : { uri, type },
    });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => router.back()}>
      <CameraCapture onClose={() => router.back()} onCaptured={handleCaptured} />
    </Modal>
  );
}
