import React from 'react';
import { View, Text, StyleSheet, Image, TextInput } from 'react-native';
import { IconPix, IconCreditCard, IconCash } from '../../lib/icons';
import { CustomButton } from '../CustomButton';
import { CustomRadioButton } from './CustomRadioButton';
import { Card } from './Card';
import { Icon } from './Icon';
import { colors } from '../../lib/theme';

interface ScheduleConfirmCardProps {
  serviceName: string;
  price: number;
  dateTime: string; // Texto formatado ex: "Hoje - 10h às 11h"
  businessName: string;
  address?: string;
  logoUrl?: string;
  isLoading?: boolean;
  paymentMethod: 'pix' | 'card' | 'cash';
  onChangePaymentMethod: (method: 'pix' | 'card' | 'cash') => void;
  observations: string;
  onChangeObservations: (text: string) => void;
  onConfirm?: (paymentMethod: 'pix' | 'card' | 'cash', observations: string) => void | Promise<void>;
  showConfirmButton?: boolean;
}

const ScheduleConfirmCard: React.FC<ScheduleConfirmCardProps> = ({
  serviceName,
  price,
  dateTime,
  businessName,
  address,
  logoUrl,
  isLoading = false,
  paymentMethod,
  onChangePaymentMethod,
  observations,
  onChangeObservations,
  onConfirm,
  showConfirmButton = true,
}) => {
  const [textInputHeight, setTextInputHeight] = React.useState(80);
  const [isObservationsFocused, setIsObservationsFocused] = React.useState(false);

  return (
    <View style={styles.mainCard}>
      <View style={styles.contentContainer}>
        {/* Appointment Details */}
        <View style={styles.appointmentDetails}>
          <Text style={styles.dateTimeText}>{dateTime}</Text>
          <Text style={styles.serviceName}>{serviceName}</Text>
          <Text style={styles.priceText}>
            R$ {price.toFixed(2).replace('.', ',')}
          </Text>
        </View>

        {/* Business Info */}
        <View style={styles.businessInfo}>
          <View style={styles.businessHeader}>
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.businessAvatar}
              />
            ) : (
              <View style={[styles.businessAvatar, styles.placeholderAvatar]} />
            )}
            <Text style={styles.businessName}>{businessName}</Text>
          </View>
          {address && (
            <Card variant="secondary" padding={16}>
              <Text style={styles.addressText}>{address}</Text>
            </Card>
          )}
        </View>

        {/* Payment Method */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Selecione o método de pagamento</Text>
          <View style={styles.paymentMethodsRow}>
            <CustomRadioButton
              label="PIX"
              selected={paymentMethod === 'pix'}
              onPress={() => onChangePaymentMethod('pix')}
              leftIcon={<IconPix size={24} color={colors.brand} />}
              value="pix"
            />
            <CustomRadioButton
              label="Cartão"
              selected={paymentMethod === 'card'}
              onPress={() => onChangePaymentMethod('card')}
              leftIcon={<IconCreditCard size={24} color={colors.brand} />}
              value="card"
            />
            <CustomRadioButton
              label="Dinheiro"
              selected={paymentMethod === 'cash'}
              onPress={() => onChangePaymentMethod('cash')}
              leftIcon={<IconCash size={24} color={colors.brand} />}
              value="cash"
            />
          </View>
        </View>

        {/* Observations */}
        <View style={styles.observationsContainer}>
          <Text style={styles.observationsLabel}>Observações</Text>
          <View style={[
            styles.textInputContainer,
            {
              borderColor: isObservationsFocused ? colors.brand : colors.textSecondary,
              borderWidth: isObservationsFocused ? 2 : 1,
            }
          ]}>
            <TextInput
              style={[styles.textInput, { height: Math.max(80, textInputHeight) }]}
              placeholder="Gostaria de sugerir um novo horário pois terei uma consulta médica nesse horário solicitado."
              placeholderTextColor="#9CA3AF"
              value={observations}
              onChangeText={onChangeObservations}
              multiline
              textAlignVertical="top"
              onFocus={() => setIsObservationsFocused(true)}
              onBlur={() => setIsObservationsFocused(false)}
              onContentSizeChange={(event) => {
                const newHeight = event.nativeEvent.contentSize.height;
                // Adiciona padding vertical (16 * 2 = 32) para manter o espaçamento
                setTextInputHeight(newHeight + 32);
              }}
            />
          </View>
        </View>
      </View>

      {/* Confirm Button */}
      {showConfirmButton && (
        <CustomButton
          title="Agendar"
          onPress={() => onConfirm?.(paymentMethod, observations)}
          isLoading={isLoading}
          disabled={isLoading}
          variant="outline"
          style={{ borderRadius: 24, marginVertical: 0 }}
          width="100%"
          rightIcon={<Icon name="check_circle" family="MaterialSymbols" size={24} color={colors.brand} />}
        />
      )}
    </View>
  );
};

export default ScheduleConfirmCard;

const styles = StyleSheet.create({
  mainCard: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    marginTop: -16,
    marginHorizontal: 0,
    width: '100%',
    flexGrow: 1,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    gap: 24,
    justifyContent: 'space-between',
  },
  contentContainer: {
    gap: 24,
  },
  appointmentDetails: {
    gap: 8,
  },
  dateTimeText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
  },
  serviceName: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  priceText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  businessInfo: {
    gap: 8,
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  businessAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
  businessName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  addressText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: colors.textPrimary,
  },
  paymentSection: {
    gap: 16,
  },
  paymentTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 24,
  },
  observationsContainer: {
    width: '100%',
    marginBottom: 0,
  },
  observationsLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: colors.brand,
    marginBottom: 4,
  },
  textInputContainer: {
    width: '100%',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    minHeight: 80,
  },
  textInput: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: colors.textPrimary,
    padding: 0,
    margin: 0,
  },
});
