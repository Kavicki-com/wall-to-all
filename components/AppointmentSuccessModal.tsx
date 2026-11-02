import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Icon } from './ui/Icon';
import { colors } from '../lib/theme';

// Figma node 2663:8057: check verde, "Agendamento concluído" e "Fechar" como
// link (button-ghost), sem botão preenchido.

interface AppointmentSuccessModalProps {
  visible: boolean;
  onClose: () => void;
}

const AppointmentSuccessModal: React.FC<AppointmentSuccessModalProps> = ({ visible, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              {/* Success Icon */}
              <Icon
                name="check_circle"
                family="MaterialSymbols"
                size={40}
                color={colors.surfaceSuccess}
              />

              {/* Success Text */}
              <Text style={styles.successText}>Agendamento concluído</Text>

              {/* Close Button */}
              <TouchableOpacity style={styles.closeButton} activeOpacity={0.8} onPress={onClose}>
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default AppointmentSuccessModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    width: 288,
    maxWidth: '100%',
    alignItems: 'center',
    gap: 16,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  successText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.surfaceSuccess,
    textAlign: 'center',
  },
  closeButton: {
    alignSelf: 'stretch',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },
});
