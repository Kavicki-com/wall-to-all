import React, { useState } from 'react';
import { View, Text, Image, TextInput, Pressable, StyleSheet } from 'react-native';
import { IconPix, IconCreditCard, IconCash } from '../../lib/icons';
import { CustomButton } from '../CustomButton';
import { CustomRadioButton } from '../ui/CustomRadioButton';
import { Icon } from '../ui/Icon';
import { CardBrandFlag } from '../payment/CardBrandFlag';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';
import type { PaymentCard } from '../../lib/services/types';
import type { BookingPaymentMethod } from '../../lib/services/bookingTypes';

export interface BookingConfirmCardProps {
  serviceName: string;
  priceCents: number;
  /** Já formatado pela tela, ex.: "Hoje 14/05/2026 - 10h". */
  dateTimeLabel: string;
  businessName: string;
  address?: string;
  logoUrl?: string;
  method: BookingPaymentMethod;
  onChangeMethod: (method: BookingPaymentMethod) => void;
  /** Cartão da linha do método; null = nenhum cartão salvo. */
  selectedCard: PaymentCard | null;
  /** "Alterar": abre a seleção de cartões. */
  onChangeCard: () => void;
  /** "Adicionar" quando não há cartão salvo. Sem ele, o link não aparece. */
  onAddCard?: () => void;
  observations: string;
  onChangeObservations: (text: string) => void;
  onPayNow: () => void;
  onPayOnSite: () => void;
  submitting: boolean;
  /** Cobre dinheiro, ausência de cartão e envio em andamento. */
  payNowDisabled: boolean;
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

// Figma node 2663:8034 (schedule-appointment-view): card principal da
// confirmação do agendamento com a escolha do método de pagamento.
export const BookingConfirmCard: React.FC<BookingConfirmCardProps> = ({
  serviceName,
  priceCents,
  dateTimeLabel,
  businessName,
  address,
  logoUrl,
  method,
  onChangeMethod,
  selectedCard,
  onChangeCard,
  onAddCard,
  observations,
  onChangeObservations,
  onPayNow,
  onPayOnSite,
  submitting,
  payNowDisabled,
}) => {
  const [observationsFocused, setObservationsFocused] = useState(false);

  return (
    <View style={styles.mainCard}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Confirmar agendamento
      </Text>

      <View style={styles.serviceCard}>
        <Text style={styles.serviceLabel}>SERVIÇO SOLICITADO</Text>
        <View style={styles.serviceRow}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>{serviceName}</Text>
            <Text style={styles.caption}>{dateTimeLabel}</Text>
          </View>
          <View style={styles.serviceValue}>
            <Text style={styles.price}>{formatBRL(priceCents)}</Text>
            <Text style={styles.caption}>A pagar</Text>
          </View>
        </View>
      </View>

      <View style={styles.businessInfo}>
        <View style={styles.businessHeader}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
          <Text style={styles.businessName}>{businessName}</Text>
        </View>
        {address ? (
          <View style={styles.addressCard}>
            <Text style={styles.addressText}>{address}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.paymentSection}>
        <Text style={styles.sectionTitle}>Selecione o método de pagamento</Text>
        <View style={styles.methodsRow}>
          <CustomRadioButton
            label="PIX"
            selected={method === 'pix'}
            onPress={() => onChangeMethod('pix')}
            leftIcon={<IconPix size={24} color={colors.brand} />}
            value="pix"
          />
          <CustomRadioButton
            label="Cartão"
            selected={method === 'card'}
            onPress={() => onChangeMethod('card')}
            leftIcon={<IconCreditCard size={24} color={colors.brand} />}
            value="card"
          />
          <CustomRadioButton
            label="Dinheiro"
            selected={method === 'cash'}
            onPress={() => onChangeMethod('cash')}
            leftIcon={<IconCash size={24} color={colors.brand} />}
            value="cash"
          />
        </View>
      </View>

      {method === 'card' ? (
        <View style={styles.methodRow}>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>Pagamento com Cartão</Text>
            {selectedCard ? (
              <View style={styles.cardLine}>
                <Text style={styles.methodDetail}>{`•••• ${selectedCard.last4}`}</Text>
                <CardBrandFlag brand={selectedCard.brand} />
              </View>
            ) : (
              <Text style={styles.methodDetail}>Nenhum cartão salvo</Text>
            )}
          </View>
          {selectedCard ? (
            <MethodRowAction label="Alterar" onPress={onChangeCard} />
          ) : onAddCard ? (
            <MethodRowAction label="Adicionar" onPress={onAddCard} />
          ) : null}
        </View>
      ) : null}

      {method === 'pix' ? (
        <View style={styles.methodRow}>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>Pagamento via PIX</Text>
            <Text style={styles.methodDetail}>QR Code na próxima etapa</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.observations}>
        <Text style={styles.observationsLabel}>Observações</Text>
        <View
          style={[styles.observationsBox, observationsFocused && styles.observationsBoxFocused]}
        >
          <TextInput
            accessibilityLabel="Observações"
            style={styles.observationsInput}
            value={observations}
            onChangeText={onChangeObservations}
            multiline
            textAlignVertical="top"
            onFocus={() => setObservationsFocused(true)}
            onBlur={() => setObservationsFocused(false)}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <CustomButton
          title="Realizar pagamento"
          onPress={onPayNow}
          disabled={payNowDisabled}
          style={styles.button}
          rightIcon={
            <Icon
              name="check_circle"
              family="MaterialSymbols"
              size={24}
              color={colors.contentLight}
            />
          }
        />
        <CustomButton
          title="Pagar na hora"
          variant="outline"
          onPress={onPayOnSite}
          disabled={submitting}
          style={styles.button}
        />
      </View>
    </View>
  );
};

const MethodRowAction: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    hitSlop={HIT_SLOP}
    onPress={onPress}
    style={styles.methodAction}
  >
    <Text style={styles.methodActionText}>{label}</Text>
    <Icon name="chevron_right" family="MaterialSymbols" size={24} color={colors.brand} />
  </Pressable>
);

const styles = StyleSheet.create({
  mainCard: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
    marginTop: -16,
    width: '100%',
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
    rowGap: 24,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  serviceCard: {
    backgroundColor: colors.surfacePrimaryExtraLight,
    borderRadius: 16,
    padding: 16,
    rowGap: 8,
  },
  serviceLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.accent,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  serviceInfo: {
    flex: 1,
    rowGap: 4,
  },
  serviceName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  serviceValue: {
    alignItems: 'flex-end',
  },
  price: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.brand,
  },
  businessInfo: {
    rowGap: 8,
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceGrey,
  },
  businessName: {
    flex: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  addressCard: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    padding: 16,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  addressText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
  paymentSection: {
    rowGap: 16,
  },
  methodsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 20,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: colors.surfacePrimaryExtraLight,
    borderRadius: 4,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
  },
  methodInfo: {
    flex: 1,
    rowGap: 4,
  },
  methodTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.textPrimary,
  },
  cardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16,
  },
  methodDetail: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  methodAction: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  methodActionText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  observations: {
    rowGap: 4,
  },
  observationsLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.brand,
  },
  observationsBox: {
    minHeight: 126,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  observationsBoxFocused: {
    borderWidth: 2,
    borderColor: colors.brand,
  },
  observationsInput: {
    flex: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
    padding: 0,
    margin: 0,
  },
  actions: {
    rowGap: 8,
  },
  button: {
    marginVertical: 0,
  },
});
