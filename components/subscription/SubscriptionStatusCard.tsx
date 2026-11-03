import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';
import { formatSubscriptionDate } from '../../lib/subscription/formatDate';
import type { Subscription, SubscriptionPlan } from '../../lib/services/subscriptionTypes';

interface SubscriptionStatusCardProps {
  subscription: Subscription;
  plan: SubscriptionPlan;
}

// Brilho do card (subscription-manage 2680:192): leve clareamento no topo sobre o navy.
const GLOW = ['rgba(214, 224, 255, 0.2)', 'rgba(0, 14, 61, 0.2)'];

/** Badge por estado: cancelamento agendado vence, depois pendência, senão ativo. */
function badgeOf(subscription: Subscription): { label: string; color: string } {
  if (subscription.cancelAtPeriodEnd) {
    return { label: 'CANCELAMENTO AGENDADO', color: colors.textSecondary };
  }
  if (subscription.status === 'past_due') {
    return { label: 'PAGAMENTO PENDENTE', color: colors.accent };
  }
  return { label: 'ATIVO', color: colors.surfaceSuccess };
}

/** Card navy do topo do Gerenciar: estado, plano, preço e próxima cobrança. */
const SubscriptionStatusCard: React.FC<SubscriptionStatusCardProps> = ({ subscription, plan }) => {
  const badge = badgeOf(subscription);
  const date = formatSubscriptionDate(subscription.currentPeriodEnd);
  const periodText = subscription.cancelAtPeriodEnd
    ? `Acesso até ${date}`
    : `Próxima cobrança em ${date}`;

  return (
    <View style={styles.card} testID="subscription-status-card">
      <LinearGradient colors={GLOW} style={styles.glow} />
      <View style={[styles.badge, { backgroundColor: badge.color }]}>
        <View style={styles.badgeDot} />
        <Text style={styles.badgeText}>{badge.label}</Text>
      </View>
      <Text style={styles.planName}>{plan.name}</Text>
      <Text style={styles.price}>{`${formatBRL(subscription.priceCents)} • cobrado mensalmente`}</Text>
      {subscription.status === 'past_due' && !subscription.cancelAtPeriodEnd ? (
        <Text style={styles.warning}>Atualize a forma de pagamento para manter o acesso.</Text>
      ) : null}
      <View style={styles.periodPill}>
        <Text style={styles.periodText}>{periodText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brand,
    borderRadius: 24,
    padding: 24,
    gap: 20,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 24,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  badgeText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.surface,
  },
  planName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.surface,
  },
  price: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.surface,
  },
  warning: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.surface,
  },
  periodPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  periodText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.surface,
  },
});

export default SubscriptionStatusCard;
