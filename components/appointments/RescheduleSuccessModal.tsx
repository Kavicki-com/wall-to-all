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
>
          <TouchableWithoutFeedback>
            <View 
              style={styles.modalContainer}
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
