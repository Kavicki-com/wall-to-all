import React from 'react';
import { Modal, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { CustomButton } from '../CustomButton';
import { colors } from '../../lib/theme';
import { formatSubscriptionDate } from '../../lib/subscription/formatDate';

interface CancelSubscriptionModalProps {
  visible: boolean;
  /** ISO do fim do período: até quando o lojista mantém o acesso. */
  accessUntil: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmação do cancelamento (decisão F7 "Confirmar + reativar"): cancelar
 * agenda o fim no `currentPeriodEnd` e pode ser desfeito com "Manter assinatura".
 * Mesmo padrão visual dos modais centrais do app (AppointmentSuccessModal).
 */
const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({
  visible,
  accessUntil,
  onConfirm,
  onClose,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback>
          <View style={styles.container}>
            <Text style={styles.title}>Cancelar assinatura?</Text>
            <Text style={styles.body}>
              {`Você mantém o acesso até ${formatSubscriptionDate(accessUntil)}.`}
            </Text>
            <CustomButton
              testID="confirm-cancel-subscription"
              title="Cancelar assinatura"
              variant="red"
              onPress={onConfirm}
              width="100%"
            />
            <CustomButton title="Voltar" variant="ghost" onPress={onClose} width="100%" />
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    width: 320,
    maxWidth: '100%',
    alignItems: 'center',
    gap: 16,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.brand,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default CancelSubscriptionModal;
