import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  IconPix,
  IconCreditCard,
  IconCash,
} from '../../lib/icons';
import { Icon } from '../ui/Icon';
import { logger } from '../../lib/logger';
import { colors } from '../../lib/theme';

export type PaymentMethod = 'pix' | 'card' | 'cash';

interface MerchantRescheduleConfirmCardProps {
  serviceName: string;
  newDate: Date;
  newTime: string;
  serviceDuration: number;
  clientName: string | null;
  clientAvatarUrl: string | null;
  paymentMethod: string;
  price: number;
  clientObservations: string | null;
  justification: string;
  onJustificationChange: (text: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

const MerchantRescheduleConfirmCard: React.FC<MerchantRescheduleConfirmCardProps> = ({
  serviceName,
  newDate,
  newTime,
  serviceDuration,
  clientName,
  clientAvatarUrl,
  paymentMethod,
  price,
  clientObservations,
  justification,
  onJustificationChange,
  onSubmit,
  isSubmitting = false,
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
    const startTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    const endTime = new Date(newDate);
    endTime.setHours(hours, minutes, 0, 0);
    endTime.setMinutes(endTime.getMinutes() + serviceDuration);
    
    const endHours = endTime.getHours();
    const endMinutes = endTime.getMinutes();
    const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    
    return `${startTimeStr} - ${endTimeStr}`;
  };

  const getPaymentMethodIcon = () => {
    const method = paymentMethod.toLowerCase();
    if (method === 'card' || method === 'credit_card' || method === 'debit_card') {
      return <IconCreditCard size={24} color={colors.brand} />;
    }
    if (method === 'cash' || method === 'dinheiro') {
      return <IconCash size={24} color={colors.brand} />;
    }
    return <IconPix size={24} color={colors.brand} />;
  };

  const getPaymentMethodLabel = () => {
    const method = paymentMethod.toLowerCase();
    if (method === 'card' || method === 'credit_card' || method === 'debit_card') {
      return 'Cartão';
    }
    if (method === 'cash' || method === 'dinheiro') {
      return 'Dinheiro';
    }
    return 'PIX';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.rescheduleLabel}>Reagendamento</Text>
        <Text style={styles.serviceName}>{serviceName}</Text>
      </View>

      {/* New Appointment Card */}
      <View style={styles.newAppointmentCard}>
        <Icon name="calendar_clock" family="MaterialSymbols" size={24} color={colors.brand} />
        <View style={styles.newAppointmentContent}>
          <Text style={styles.newAppointmentDate}>
            {formatDateLong(newDate)}
          </Text>
          <Text style={styles.newAppointmentTime}>
            {formatTimeRange()}
          </Text>
        </View>
      </View>

      {/* Client Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Cliente:</Text>
        <View style={styles.clientInfo}>
          {clientAvatarUrl ? (
            <Image
              source={{ uri: clientAvatarUrl }}
              style={styles.clientAvatar}
            />
          ) : (
            <View style={[styles.clientAvatar, styles.placeholderAvatar]} />
          )}
          <Text style={styles.clientName}>
            {clientName || 'Cliente'}
          </Text>
        </View>
      </View>

      {/* Payment Method Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Método de pagamento:</Text>
        <View style={styles.paymentCard}>
          {getPaymentMethodIcon()}
          <View style={styles.paymentContent}>
            <Text style={styles.paymentMethod}>{getPaymentMethodLabel()}</Text>
            <Text style={styles.paymentAmount}>
              R$ {price.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>
      </View>

      {/* Client Observations Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Observações do cliente:</Text>
        <View style={styles.observationsContainer}>
          <Text style={styles.observationsText}>
            {clientObservations || 'Nenhuma observação'}
          </Text>
        </View>
      </View>

      {/* Justification Section */}
      <View style={styles.justificationSection}>
        <Text style={styles.justificationLabel}>Justificativa</Text>
        <View style={styles.justificationContainer}>
          <TextInput
            style={styles.justificationInput}
            value={justification}
            onChangeText={onJustificationChange}
            placeholder="Digite a justificativa para o reagendamento..."
            placeholderTextColor="#999999"
            multiline
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={() => {
          logger.debug('[MerchantRescheduleConfirmCard] Botão Enviar pressionado');
          logger.debug('[MerchantRescheduleConfirmCard] isSubmitting:', isSubmitting);
          if (!isSubmitting) {
            onSubmit();
          }
        }}
        disabled={isSubmitting}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={colors.surface} />
        ) : (
          <Text style={styles.submitButtonText}>Enviar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default MerchantRescheduleConfirmCard;

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  header: {
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
  sectionLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderAvatar: {
    backgroundColor: '#E5E5E5',
  },
  clientName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000000',
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    ...Platform.select({
      ios: {
        shadowColor: '#1D1D1D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
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
  observationsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  observationsText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000000',
    lineHeight: 24,
  },
  justificationSection: {
    gap: 16,
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
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minHeight: 120,
  },
  justificationInput: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000000',
    lineHeight: 24,
    flex: 1,
  },
  submitButton: {
    backgroundColor: colors.brand,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#1D1D1D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.24,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.surface,
  },
});
