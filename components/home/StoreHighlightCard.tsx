import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Chip } from '../ui/Chip';
import { IconPix, IconCreditCard, IconCash } from '../../lib/icons';
import { formatWorkDays } from '../../lib/workDaysUtils';
import { priceTier } from '../../lib/dashboardMetrics';
import { getInitials } from '../../lib/formatters';
import { colors } from '../../lib/theme';
import type { Business, AcceptedPaymentMethods } from '../../lib/types';

export interface StoreHighlightCardProps {
  /** Negócio em destaque exibido no card. */
  business: Business;
  /** Disparado ao tocar no card inteiro. */
  onPress: () => void;
}

// Largura fixa do card conforme o Figma (2715:3469).
const CARD_WIDTH = 255;
// Altura da faixa do hero (imagem) e sobreposição do avatar, também do Figma.
const HERO_HEIGHT = 122;
const AVATAR_OVERLAP = 72;

/**
 * Card do negócio em destaque na home do cliente (F2 — Dashboards/Home).
 *
 * Puramente apresentacional: recebe um `Business` e um `onPress`. A lógica de
 * negócio (faixa de preço) vem de `priceTier`; a formatação de horários de
 * `formatWorkDays`. Chips de serviço reutilizam o `Chip` do design system.
 *
 * Seções (topo → base): hero (banner + avatar + nome/descrição), preço médio,
 * chips de serviços, horário de funcionamento e pagamentos aceitos. Cada seção
 * opcional some quando não há dado (sem preços, sem serviços, sem pagamentos).
 */
export const StoreHighlightCard: React.FC<StoreHighlightCardProps> = ({
  business,
  onPress,
}) => {
  const hasBanner = !!business.banner_url && business.banner_url.trim() !== '';
  const hasLogo = !!business.logo_url && business.logo_url.trim() !== '';

  // Faixa de preço a partir dos serviços PRECIFICADOS. Sem preços → sem faixa.
  const prices = (business.services ?? [])
    .map((s) => s.price)
    .filter((p): p is number => typeof p === 'number');
  const tier = priceTier(prices);

  const services = business.services ?? [];

  // Horários: `work_days` pode chegar como Json — o util aceita o formato
  // Record<string, {start, end}> | null, então fazemos o cast necessário.
  const workDaysLabel = formatWorkDays(
    (business.work_days ?? null) as Parameters<typeof formatWorkDays>[0],
  );

  // Pagamentos aceitos: campo pode ser Json/null; tratamos como o shape esperado.
  const payments = (business.accepted_payment_methods ?? {}) as AcceptedPaymentMethods;
  const paymentMethods = [
    payments.pix ? { key: 'pix', label: 'PIX', Icon: IconPix } : null,
    payments.card ? { key: 'card', label: 'Cartão', Icon: IconCreditCard } : null,
    payments.cash ? { key: 'cash', label: 'Dinheiro', Icon: IconCash } : null,
  ].filter((m): m is { key: string; label: string; Icon: typeof IconPix } => m !== null);

  return (
    <Pressable
      testID="store-highlight-card"
      accessibilityRole="button"
      accessibilityLabel={`Loja ${business.business_name}`}
      onPress={onPress}
      style={styles.card}
    >
      {/* ── Hero: banner + avatar sobreposto + nome/descrição ── */}
      <View style={styles.hero}>
        <View style={styles.heroImageWrapper}>
          {hasBanner ? (
            <Image
              source={{ uri: business.banner_url as string }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            // Fallback sem banner: bloco cinza (sem Image remota).
            <View style={[styles.heroImage, styles.heroPlaceholder]} />
          )}
          {/* Overlay navy translúcido para legibilidade do texto sobre a imagem.
              Cor crua permitida: tokens não expressam alfa sobre imagem
              (precedente da F1 para overlays translúcidos). */}
          <LinearGradient
            colors={['transparent', 'rgba(0,14,61,0.5)']}
            style={styles.heroOverlay}
          />
        </View>

        <View style={styles.profileRow}>
          {hasLogo ? (
            <Image
              source={{ uri: business.logo_url as string }}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            // Fallback sem logo: círculo claro com iniciais na cor da marca.
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>
                {getInitials(business.business_name)}
              </Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.businessName} numberOfLines={1}>
              {business.business_name}
            </Text>
            {!!business.description && (
              <Text style={styles.businessDescription} numberOfLines={1}>
                {business.description}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* ── Preço médio (some sem serviços precificados) ── */}
      {tier !== null && (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Preço médio</Text>
          <Text>
            <Text testID="price-lit" style={styles.priceLit}>
              {'$'.repeat(tier)}
            </Text>
            <Text testID="price-dim" style={styles.priceDim}>
              {'$'.repeat(5 - tier)}
            </Text>
          </Text>
        </View>
      )}

      {/* ── Chips de serviços (linha horizontal recortada) ── */}
      {services.length > 0 && (
        <View testID="service-chips" style={styles.serviceChips}>
          {services.map((service, index) => (
            <Chip key={service.id ?? `service-${index}`} label={service.name} />
          ))}
        </View>
      )}

      {/* ── Horário de funcionamento ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitleBrand}>Horário de funcionamento</Text>
        <Text style={styles.sectionValue}>{workDaysLabel}</Text>
      </View>

      {/* ── Pagamentos aceitos (some sem nenhum método) ── */}
      {paymentMethods.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitleDark}>Pagamentos aceitos</Text>
          <View style={styles.paymentRow}>
            {paymentMethods.map(({ key, label, Icon }) => (
              <View key={key} style={styles.paymentBadge}>
                <Icon width={16} height={16} color={colors.brand} />
                <Text style={styles.paymentLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    // Sombra sutil do Figma: 0px 4px 16px rgba(29,29,29,0.08) → colors.shadow.
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },

  // ── Hero ──
  hero: {
    width: '100%',
  },
  heroImageWrapper: {
    height: HERO_HEIGHT,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    // Puxa a linha do avatar para sobrepor a base do hero (padrão do Figma).
    marginBottom: -AVATAR_OVERLAP,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    backgroundColor: colors.surfaceGrey,
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    borderRadius: 8,
  },
  profileRow: {
    height: AVATAR_OVERLAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfacePrimaryExtraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: colors.brand,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  businessName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  businessDescription: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 8,
    color: colors.contentLight,
  },

  // ── Preço médio ──
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  priceLit: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.accent,
  },
  priceDim: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.surfaceGrey,
  },

  // ── Chips de serviços ──
  serviceChips: {
    flexDirection: 'row',
    gap: 4,
    overflow: 'hidden',
  },

  // ── Seções de texto (horário / pagamentos) ──
  section: {
    paddingVertical: 8,
    gap: 8,
  },
  sectionTitleBrand: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.brand,
  },
  sectionTitleDark: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.textPrimary,
  },
  sectionValue: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },

  // ── Pagamentos ──
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
});
