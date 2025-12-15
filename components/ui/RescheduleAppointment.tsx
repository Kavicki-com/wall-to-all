import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import {
  IconPix,
  IconCreditCard,
  IconCash,
  IconCheckCircle,
} from '../../lib/icons';
import { CustomButton } from '../CustomButton';
import { CustomInput } from './CustomInput';

export type PaymentMethod = 'pix' | 'card' | 'cash';

interface RescheduleAppointmentProps {
  date: string;
  time: string;
  serviceName: string;
  price: number;
  businessName: string;
  businessAddress?: string | null;
  businessLogoUrl?: string | null;
  paymentMethod: PaymentMethod;
  clientNote?: string;
  showJustification?: boolean;
  justification?: string;
  onChangeJustification?: (text: string) => void;
  confirmButtonLabel?: string;
  onConfirm?: () => void;
  linkLabel?: string;
  onLinkPress?: () => void;
  primaryButtonLabel?: string;
  onPrimaryAction?: () => void;
}

const RescheduleAppointment: React.FC<RescheduleAppointmentProps> = ({
  date,
  time,
  serviceName,
  price,
  businessName,
  businessAddress,
  businessLogoUrl,
  paymentMethod,
  clientNote,
  showJustification = false,
  justification = '',
  onChangeJustification,
  confirmButtonLabel,
  onConfirm,
  linkLabel,
  onLinkPress,
  primaryButtonLabel,
  onPrimaryAction,
}) => {
  const [localJustification, setLocalJustification] = useState(justification);

  useEffect(() => {
    setLocalJustification(justification);
  }, [justification]);

  const handleJustificationChange = (text: string) => {
    setLocalJustification(text);
    if (onChangeJustification) {
      onChangeJustification(text);
    }
  };

  const formatDateTime = (): string => {
    if (!date || !time) return '';
    // Converter a data para Date local, evitando problemas de timezone
    // Se date está no formato "yyyy-MM-dd", criar Date local diretamente
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateObjNormalized = new Date(year, month - 1, day);
    dateObjNormalized.setHours(0, 0, 0, 0);
    const isToday = dateObjNormalized.getTime() === today.getTime();
    const timeString = time.slice(0, 5);
    if (isToday) return `Hoje - ${timeString}`;
    const dayStr = String(dateObj.getDate()).padStart(2, '0');
    const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${dayStr}/${monthStr} - ${timeString}`;
  };

  const renderPaymentIcon = () => {
    switch (paymentMethod) {
      case 'card':
        return <IconCreditCard size={24} color="#000E3D" />;
      case 'cash':
        return <IconCash size={24} color="#000E3D" />;
      case 'pix':
      default:
        return <IconPix size={24} color="#000E3D" />;
    }
  };

  const paymentLabel =
    paymentMethod === 'card'
      ? 'Cartão'
      : paymentMethod === 'cash'
      ? 'Dinheiro'
      : 'PIX';

  return (
    <View style={styles.card}>
      <Text style={styles.dateTime}>{formatDateTime()}</Text>
      <Text style={styles.service}>{serviceName}</Text>

      <Text style={styles.label}>Profissional</Text>
      <View style={styles.businessSection}>
        <View style={styles.businessRow}>
          {businessLogoUrl ? (
            <Image source={{ uri: businessLogoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
          <Text style={styles.businessName}>{businessName}</Text>
        </View>
        {businessAddress ? (
          <View style={styles.addressCard}>
            <Text style={styles.address}>{businessAddress}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.label}>Método de pagamento:</Text>
      <View style={styles.paymentCard}>
        {renderPaymentIcon()}
        <View style={styles.paymentTexts}>
          <Text style={styles.paymentMethod}>{paymentLabel}</Text>
          <Text style={styles.paymentAmount}>
            R$ {price.toFixed(2).replace('.', ',')}
          </Text>
        </View>
      </View>

      {/* Observações visíveis apenas quando não está em modo de justificativa */}
      {!showJustification && clientNote ? (
        <View style={styles.noteSection}>
          <Text style={styles.noteLabel}>Observações do cliente:</Text>
          <Text style={styles.noteText}>{clientNote}</Text>
        </View>
      ) : null}

      {showJustification ? (
        // Modo justificativa: exibe CustomInput e botão primário
        <View style={styles.justificationSection}>
          <CustomInput
            label="Justificativa"
            placeholder="Explique o motivo da mudança de horário"
            value={localJustification}
            onChangeText={handleJustificationChange}
            multiline
            numberOfLines={4}
            containerStyle={{ marginBottom: 0 }}
            inputContainerStyle={{ minHeight: 100 }}
          />
          {primaryButtonLabel && onPrimaryAction ? (
            <CustomButton
              title={primaryButtonLabel}
              onPress={onPrimaryAction}
              variant="outline"
              style={{ borderRadius: 24, marginTop: 24 }}
              width="100%"
            />
          ) : null}
        </View>
      ) : (
        // Modo normal: exibe botão de confirmação e link secundário, se fornecidos
        <>
          {confirmButtonLabel && onConfirm ? (
            <View style={styles.confirmButtonContainer}>
              <CustomButton
                title={confirmButtonLabel}
                onPress={onConfirm}
                variant="outline"
                style={{ borderRadius: 24 }}
              width="100%"
              />
              <IconCheckCircle size={20} color="#000E3D" style={styles.checkIcon} />
            </View>
          ) : null}
          {linkLabel && onLinkPress ? (
            <TouchableOpacity onPress={onLinkPress} style={styles.linkButton}>
              <Text style={styles.linkText}>{linkLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
};

export default RescheduleAppointment;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FEFEFE',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    gap: 16,
    width: '100%',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dateTime: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  service: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  label: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginTop: 16,
  },
  businessSection: {
    marginTop: 8,
    gap: 8,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: '#E0E0E0',
  },
  businessName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  addressCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    padding: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  address: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 16,
    gap: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    marginTop: 8,
  },
  paymentTexts: {
    flex: 1,
    flexDirection: 'column',
  },
  paymentMethod: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  paymentAmount: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  noteSection: {
    marginTop: 16,
    gap: 4,
  },
  noteLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  noteText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  justificationSection: {
    marginTop: 16,
  },
  linkButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#E5102E',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    textAlign: 'center',
  },
  confirmButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    marginLeft: 8,
  },
});
