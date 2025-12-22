import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { IconCheckCircle } from '../../lib/icons';

interface RescheduleSuccessModalProps {
  visible: boolean;
  onClose: () => void;
}

const RescheduleSuccessModal: React.FC<RescheduleSuccessModalProps> = ({
  visible,
  onClose,
}) => {
  // #region agent log
  React.useEffect(() => {
    if (visible) {
      const { width, height } = Dimensions.get('window');
      fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RescheduleSuccessModal.tsx:25',message:'Modal renderizado - dimensões da tela',data:{visible,windowWidth:width,windowHeight:height,overlayPadding:24,modalPadding:24,closeButtonMarginTop:8},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
  }, [visible]);
  // #endregion

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View 
          style={styles.overlay}
          // #region agent log
          onLayout={(event) => {
            const { width, height, x, y } = event.nativeEvent.layout;
            fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RescheduleSuccessModal.tsx:45',message:'Overlay layout medido',data:{overlayWidth:width,overlayHeight:height,overlayX:x,overlayY:y,overlayPadding:24},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          }}
          // #endregion
        >
          <TouchableWithoutFeedback>
            <View 
              style={styles.modalContainer}
              // #region agent log
              onLayout={(event) => {
                const { width, height, x, y } = event.nativeEvent.layout;
                fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RescheduleSuccessModal.tsx:55',message:'ModalContainer layout medido - POST-FIX',data:{containerWidth:width,containerHeight:height,containerX:x,containerY:y,containerPaddingTop:24,containerPaddingBottom:0,containerGap:16,closeButtonMarginTop:8,closeButtonMarginBottom:24},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'FIX'})}).catch(()=>{});
              }}
              // #endregion
            >
              {/* Success Icon */}
              <View style={styles.iconContainer}>
                <IconCheckCircle size={67} color="#17723F" />
              </View>

              {/* Success Title */}
              <Text style={styles.successTitle}>Sugestão de novo horário enviada</Text>

              {/* Success Message */}
              <Text style={styles.successMessage}>
                Aguarde o seu cliente confirmar a sua sugestão
              </Text>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                activeOpacity={0.8}
                onPress={onClose}
                // #region agent log
                onLayout={(event) => {
                  const { width, height, x, y } = event.nativeEvent.layout;
                  fetch('http://127.0.0.1:7245/ingest/9d7f4bcc-3db1-4812-9bec-f164138d1916',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RescheduleSuccessModal.tsx:70',message:'CloseButton layout medido - POST-FIX',data:{buttonWidth:width,buttonHeight:height,buttonX:x,buttonY:y,buttonMarginTop:8,buttonMarginBottom:24,containerPaddingTop:24,containerPaddingBottom:0,overlayPadding:24},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'FIX'})}).catch(()=>{});
                }}
                // #endregion
              >
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default RescheduleSuccessModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 0,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 67,
    height: 67,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 24,
  },
  closeButton: {
    width: '100%',
    backgroundColor: '#000E3D',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
});
