import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import {
  IconPix,
  IconCreditCard,
  IconCash,
  IconDateRange,
} from '../../lib/icons';
import SectionTitle from './SectionTitle';
import SurfaceCard from './SurfaceCard';
import { CustomButton } from '../CustomButton';
import { colors } from '../../lib/theme';

export type PaymentMethod = 'pix' | 'card' | 'cash';

interface RescheduleModalCardProps {
  // Dados do agendamento original
  serviceName: string;
  price: number;
  businessName: string;
  businessAddress?: string | null;
  businessLogoUrl?: string | null;
  paymentMethod: PaymentMethod;
  
  // Nova data/hora proposta
  newDate: Date;
  newTime: string;
  serviceDuration: number; // em minutos
  
  // Justificativa
  justification: string;
  
  // Callbacks
  onSubmit: () => void;
}

const RescheduleModalCard: React.FC<RescheduleModalCardProps> = ({
  serviceName,
  price,
  businessName,
  businessAddress,
  businessLogoUrl,
  paymentMethod,
  newDate,
  newTime,
  serviceDuration,
  justification,
  onSubmit,
}) => {
  const formatDateLong = (date: Date) => {
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return `${date.getDate()} de ${months[date.getMonth()]}`;
  };

  const formatTimeRange = () => {
    const [hours, minutes] = newTime.split(':').map(Number);
    const endTime = new Date(newDate);
    endTime.setHours(hours, minutes, 0, 0);
    endTime.setMinutes(endTime.getMinutes() + serviceDuration);
    return `${hours}h às ${endTime.getHours()}h`;
  };

  const renderPaymentIcon = () => {
    switch (paymentMethod) {
      case 'card':
        return <IconCreditCard size={24} color={colors.brand} />;
      case 'cash':
        return <IconCash size={24} color={colors.brand} />;
      case 'pix':
      default:
        return <IconPix size={24} color={colors.brand} />;
    }
  };

  const paymentLabel =
    paymentMethod === 'card'
      ? 'Cartão'
      : paymentMethod === 'cash'
      ? 'Dinheiro'
      : 'PIX';

  return (
    <View style={styles.container}>
      <View style={styles.cardContent}>
      {/* Heading */}
      <View style={styles.heading}>
        <View style={styles.headingContent}>
          <SectionTitle>Reagendamento</SectionTitle>
          <Text style={styles.serviceName}>{serviceName}</Text>
        </View>

        {/* New Appointment Card */}
        <SurfaceCard style={styles.newAppointmentCard}>
          <IconDateRange size={24} color={colors.brand} />
          <View style={styles.newAppointmentContent}>
            <Text style={styles.newAppointmentDate}>
              {formatDateLong(newDate)}
            </Text>
            <Text style={styles.newAppointmentTime}>
              {formatTimeRange()}
            </Text>
          </View>
        </SurfaceCard>
      </View>

      {/* Professional Info */}
      <View style={styles.section}>
        <SectionTitle>Profissional:</SectionTitle>
        <View style={styles.professionalInfo}>
          <View style={styles.professionalHeader}>
            {businessLogoUrl ? (
              <Image
                source={{ uri: businessLogoUrl }}
                style={styles.businessLogo}
              />
            ) : (
              <View style={[styles.businessLogo, styles.placeholderLogo]} />
            )}
            <Text style={styles.businessName}>{businessName}</Text>
          </View>
          {businessAddress && (
            <SurfaceCard style={styles.addressCard}>
              <Text style={styles.addressText}>{businessAddress}</Text>
            </SurfaceCard>
          )}
        </View>
      </View>

      {/* Payment Method */}
      <View style={styles.section}>
        <SectionTitle>Método de pagamento:</SectionTitle>
        <SurfaceCard style={styles.paymentCard}>
          {renderPaymentIcon()}
          <View style={styles.paymentContent}>
            <Text style={styles.paymentMethod}>{paymentLabel}</Text>
            <Text style={styles.paymentAmount}>
              R$ {price.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </SurfaceCard>
      </View>

      {/* Justification and Submit Button Container */}
      <View style={styles.justificationAndButtonContainer}>
        <Text style={styles.justificationLabel}>Justificativa</Text>
        <View style={styles.justificationContainer}>
          <Text style={styles.justificationText}>
            {justification || 'Não vou conseguir chegar no horário e gostaria de trocar para o horário seguinte.'}
          </Text>
        </View>

        {/* Submit Button */}
        <CustomButton
          title="Enviar"
          onPress={onSubmit}
          variant="primary"
          style={styles.submitButton}
        />
      </View>
      </View>
    </View>
  );
};

export default RescheduleModalCard;

const styles = StyleSheet.create({
  container: {
    gap: 0,
    width: '100%',
    flexShrink: 1,
    backgroundColor: colors.surface,
  },
  cardContent: {
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  heading: {
    gap: 8,
  },
  headingContent: {
    gap: 8,
  },
  rescheduleLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
  },
  serviceName: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  newAppointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#EBEFFF',
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: 24,
    padding: 16,
  },
  newAppointmentContent: {
    flex: 1,
    gap: 8,
  },
  newAppointmentDate: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },
  newAppointmentTime: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },
  section: {
    gap: 8,
  },
  professionalInfo: {
    gap: 8,
  },
  professionalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  businessLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderLogo: {
    backgroundColor: '#E5E5E5',
  },
  businessName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000000',
  },
  addressCard: {
    marginTop: 0,
  },
  addressText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000000',
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  paymentContent: {
    flex: 1,
    gap: 8,
  },
  paymentMethod: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000000',
  },
  paymentAmount: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  justificationAndButtonContainer: {
    gap: 16,
    width: '100%',
  },
  justificationLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000000',
  },
  justificationContainer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  justificationText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000000',
    lineHeight: 24,
  },
  submitButton: {
    marginTop: 0,
    borderRadius: 25,
    height: 50,
    overflow: 'hidden',
  },
});
