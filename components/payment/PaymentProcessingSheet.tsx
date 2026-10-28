import React from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';
import { IconLoading } from '../../lib/assets';

export interface PaymentProcessingSheetProps {
  visible: boolean;
  /** Default: "Processando seu pagamento...". */
  message?: string;
}

// Mantém o sheet sem ação enquanto o pagamento processa: nem backdrop nem
// botão voltar do Android fecham (quem fecha é o pai, ao fim da cobrança).
const noop = () => undefined;

// Figma node 2663:9149: sheet claro com o logo de tijolos ("Loading") centrado
// e o texto de processamento. Sem botões nem backdrop clicável.
export const PaymentProcessingSheet: React.FC<PaymentProcessingSheetProps> = ({
  visible,
  message = 'Processando seu pagamento...',
}) => {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={noop}>
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.content}>
            <View testID="payment-processing-logo">
              <IconLoading width={49} height={35} />
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.message}>
              {message}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    height: 600,
    maxHeight: '90%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    rowGap: 16,
    alignItems: 'center',
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceGrey,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 10,
  },
  message: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
