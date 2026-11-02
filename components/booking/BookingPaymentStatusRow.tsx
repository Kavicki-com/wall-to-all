import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconPix, IconCreditCard, IconCash } from '../../lib/icons';
import { colors } from '../../lib/theme';
import type { BookingPayment, BookingPaymentMethod } from '../../lib/services/bookingTypes';

// Linha de status do pagamento no detalhe do agendamento (F5, Task 8).
// Sem registro no BookingPaymentService (ex.: agendamento anterior à F5),
// cai no payment_method gravado no appointment.

interface BookingPaymentStatusRowProps {
  payment: BookingPayment | null;
  /** payment_method do appointment, usado quando não há registro. */
  fallbackMethod?: BookingPaymentMethod | null;
}

const METHOD_LABEL: Record<BookingPaymentMethod, string> = {
  pix: 'Pix',
  card: 'Cartão',
  cash: 'Dinheiro',
};

function statusLabel(payment: BookingPayment): string {
  if (payment.status === 'pay_on_site') {
    return `Pagar na hora (${METHOD_LABEL[payment.method]})`;
  }
  if (payment.method === 'card') {
    return `Pago com cartão •••• ${payment.cardLast4 ?? ''}`.trim();
  }
  return `Pago via ${METHOD_LABEL[payment.method]}`;
}

function MethodIcon({ method }: { method: BookingPaymentMethod }) {
  switch (method) {
    case 'card':
      return <IconCreditCard size={24} color={colors.brand} />;
    case 'cash':
      return <IconCash size={24} color={colors.brand} />;
    default:
      return <IconPix size={24} color={colors.brand} />;
  }
}

export function BookingPaymentStatusRow({ payment, fallbackMethod }: BookingPaymentStatusRowProps) {
  const method = payment?.method ?? fallbackMethod ?? null;
  if (!method) return null;

  const label = payment ? statusLabel(payment) : `Pagamento: ${METHOD_LABEL[method]}`;

  return (
    <View style={styles.container} accessibilityLabel={label}>
      <MethodIcon method={method} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: colors.textPrimary,
  },
});
