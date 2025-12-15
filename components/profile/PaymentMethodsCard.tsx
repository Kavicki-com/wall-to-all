import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SurfaceCard from '../ui/SurfaceCard';
import IconLabel from '../ui/IconLabel';
// Import icons from the library. The relative path assumes this file
// resides in components/profile and the icons are in lib/icons.
import { IconPix, IconCreditCard, IconCash } from '../../lib/icons';

interface PaymentMethods {
  pix?: boolean;
  card?: boolean;
  cash?: boolean;
}

interface PaymentMethodsCardProps {
  /**
   * Object describing which payment methods are accepted by the business.
   */
  methods: PaymentMethods;
}

/**
 * Card displaying the accepted payment methods. It supports PIX,
 * Card and Cash, showing only those that are enabled. Uses
 * `IconLabel` to ensure consistent spacing and font sizes.
 */
const PaymentMethodsCard: React.FC<PaymentMethodsCardProps> = ({ methods }) => {
  return (
    <SurfaceCard style={styles.card}>
      <Text style={styles.title}>Pagamentos aceitos</Text>
      <View style={styles.iconsRow}>
        {methods.pix && <IconLabel icon={<IconPix width={24} height={24} />} label="PIX" />}
        {methods.card && (
          <IconLabel
            icon={<IconCreditCard width={24} height={24} color="#000E3D" />}
            label="Cartão"
          />
        )}
        {methods.cash && (
          <IconLabel
            icon={<IconCash width={24} height={24} color="#000E3D" />}
            label="Dinheiro"
          />
        )}
      </View>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    // Use a small margin bottom consistent with other cards (8px).
    marginBottom: 8,
    paddingHorizontal: 16,
    // Increase vertical padding for better visual balance with the row of icons.
    paddingVertical: 16,
    // The card acts as a column: title on top, icons below.
    flexDirection: 'column',
    gap: 12,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  iconsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
});

export default PaymentMethodsCard;