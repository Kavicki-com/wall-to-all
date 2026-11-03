import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomButton } from '../CustomButton';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';
import type { SubscriptionPlan } from '../../lib/services/subscriptionTypes';

interface SubscriptionOfferViewProps {
  plan: SubscriptionPlan;
  onSubscribe: () => void;
  onOpenTerms: () => void;
  /** Sem cartão salvo não há como assinar (o lojista ainda não cadastra cartão). */
  subscribeDisabled: boolean;
  /** Aviso exibido abaixo do CTA quando ele está desabilitado. */
  noCardHint?: string;
}

// Brilho do hero (subscription-offer 2678:165), igual ao card de status.
const GLOW = ['rgba(214, 224, 255, 0.2)', 'rgba(0, 14, 61, 0.2)'];

/** "29,90" a partir de centavos, para o preço grande do hero. */
function priceNumber(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Oferta do plano único (subscription-offer `2678:150`). */
const SubscriptionOfferView: React.FC<SubscriptionOfferViewProps> = ({
  plan,
  onSubscribe,
  onOpenTerms,
  subscribeDisabled,
  noCardHint,
}) => (
  <View style={styles.container}>
    <View style={styles.hero}>
      <LinearGradient colors={GLOW} style={styles.glow} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{plan.badge}</Text>
      </View>
      <Text style={styles.planName}>{plan.name}</Text>
      <Text style={styles.description}>{plan.description}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.currency}>R$</Text>
        <Text style={styles.price}>{priceNumber(plan.priceCents)}</Text>
        <Text style={styles.interval}>/mês</Text>
      </View>
    </View>

    <Text style={styles.sectionTitle}>O que está incluso</Text>
    <View style={styles.features}>
      {plan.features.map((feature) => (
        <View key={feature} style={styles.feature}>
          <Icon name="check_circle" family="MaterialSymbols" size={24} color={colors.surfaceSuccess} />
          <Text style={styles.featureText}>{feature}</Text>
        </View>
      ))}
    </View>

    <View style={styles.guarantee}>
      <Icon name="check_circle" family="MaterialSymbols" size={24} color={colors.brand} />
      <View style={styles.guaranteeTexts}>
        <Text style={styles.guaranteeTitle}>Cancele quando quiser</Text>
        {/* O Figma usa travessão nesta frase; trocado por vírgula (regra de escrita do projeto). */}
        <Text style={styles.guaranteeBody}>
          Sem fidelidade, você assina por mês e cancela direto pelo app.
        </Text>
      </View>
    </View>

    <View style={styles.ctaBlock}>
      <CustomButton
        testID="subscribe-cta"
        title={`Assinar por ${formatBRL(plan.priceCents)}/mês`}
        onPress={onSubscribe}
        disabled={subscribeDisabled}
        width="100%"
      />
      {subscribeDisabled && noCardHint ? <Text style={styles.hint}>{noCardHint}</Text> : null}
    </View>

    <Pressable accessibilityRole="link" onPress={onOpenTerms} style={styles.terms}>
      <Text style={styles.termsText}>Termos do plano e política de cobrança</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  hero: {
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
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
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
  description: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.surface,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  currency: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.surface,
  },
  price: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 40,
    lineHeight: 44,
    color: colors.surface,
  },
  interval: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.surface,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: colors.accent,
  },
  features: {
    gap: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    flex: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.brand,
  },
  guarantee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surfacePrimaryExtraLight,
  },
  guaranteeTexts: {
    flex: 1,
    gap: 4,
  },
  guaranteeTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  guaranteeBody: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  ctaBlock: {
    gap: 8,
  },
  hint: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  terms: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  termsText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
    textAlign: 'center',
  },
});

export default SubscriptionOfferView;
