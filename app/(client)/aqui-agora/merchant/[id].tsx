import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueueService } from '../../../../context/ServicesContext';
import { TopBar } from '../../../../components/layout/TopBar';
import { Icon } from '../../../../components/ui/Icon';
import { FuraFilaIcon } from '../../../../components/icons/FuraFilaIcon';
import { colors } from '../../../../lib/theme';
import { formatBRL } from '../../../../lib/formatters';
import { useMerchant } from '../../../../lib/hooks/useNearbyMerchants';

/**
 * Perfil do lojista (cliente) da experiência "Aqui e Agora". Recebe o `[id]` do
 * merchant pela rota, carrega os merchants próximos via `QueueService`
 * (`useQueueService`, nunca instanciado aqui) e localiza o merchant pelo id —
 * um `NearbyMerchant` já traz nome, categoria, rating e a `QueueInfo` embutida
 * (`.queue`: status, ticketsWaiting, estimatedWaitMinutes, settings).
 *
 * CTA primário "Entrar na fila": chama `joinQueue(merchantId)` e, ao resolver,
 * navega para a lista de espera. CTA fura-fila só aparece quando
 * `queue.settings.furaFilaEnabled` e leva à seleção de fura-fila.
 */
const MerchantProfileScreen: React.FC = () => {
  const router = useRouter();
  const queueService = useQueueService();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { merchant, status } = useMerchant(id);
  const [joining, setJoining] = useState(false);

  const handleJoin = useCallback(async () => {
    if (joining || !merchant) return;
    setJoining(true);
    try {
      await queueService.joinQueue(merchant.id);
      router.push('/(client)/aqui-agora/waiting-list');
    } catch {
      // Reabilita o CTA para nova tentativa se a entrada na fila falhar.
      setJoining(false);
    }
  }, [joining, merchant, queueService, router]);

  const handleFuraFila = useCallback(() => {
    if (!merchant) return;
    router.push({
      pathname: '/(client)/aqui-agora/fura-fila',
      params: { merchantId: merchant.id },
    });
  }, [merchant, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <TopBar variant="brand" onBack={handleBack} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </View>
    );
  }

  if (status === 'error' || !merchant) {
    return (
      <View style={styles.container}>
        <TopBar variant="brand" onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Não foi possível carregar este estabelecimento.</Text>
        </View>
      </View>
    );
  }

  const { queue } = merchant;
  const { settings } = queue;

  return (
    <View style={styles.container}>
      <TopBar variant="brand" onBack={handleBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero + identidade (nome/categoria/rating) sobre a marca (navy). */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Icon name="storefront" size={40} color={colors.white} />
          </View>
          <Text style={styles.name}>{merchant.name}</Text>
          <Text style={styles.category}>{merchant.category}</Text>
          <View style={styles.ratingRow}>
            <Icon name="star" size={18} color={colors.warning} />
            <Text style={styles.ratingValue}>{merchant.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>(897)</Text>
            <Text style={styles.priceLevel}>· $$$ Preço médio</Text>
          </View>
        </View>

        {/* KPIs decorativos do painel do lojista (números estáticos). */}
        <View style={styles.kpiRow}>
          {KPIS.map((kpi) => (
            <View key={kpi.label} style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* Formas de pagamento e horário (decorativos, estáticos). */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Formas de pagamento</Text>
          <Text style={styles.infoText}>PIX · Cartão · Dinheiro</Text>
          <Text style={[styles.infoTitle, styles.infoTitleSpaced]}>Horário de funcionamento</Text>
          <Text style={styles.infoText}>Seg à Sex · 10h às 18h</Text>
        </View>

        {/* Serviço solicitado (decorativo/estático, sem nome específico). */}
        <View style={styles.serviceCard}>
          <Text style={styles.serviceLabel}>SERVIÇO SOLICITADO</Text>
          <View style={styles.serviceRow}>
            <View>
              <Text style={styles.serviceName}>Serviço solicitado</Text>
              <Text style={styles.serviceMeta}>~30 min · Valor a pagar</Text>
            </View>
            <Text style={styles.servicePrice}>R$ 80</Text>
          </View>
        </View>

        {/* Estado da fila — reflete ticketsWaiting e estimatedWaitMinutes. */}
        <View style={styles.queueCard}>
          <Text style={styles.queueCount}>
            ({queue.ticketsWaiting}) pessoas já estão nessa fila
          </Text>
          <Text style={styles.queueWait}>~{queue.estimatedWaitMinutes} min de espera</Text>
        </View>

        {/* CTA primário: entrar na fila. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: joining }}
          style={[styles.primaryCta, joining && styles.primaryCtaDisabled]}
          disabled={joining}
          onPress={handleJoin}
        >
          <Text style={styles.primaryCtaText}>Entrar na fila</Text>
        </Pressable>

        {/* CTA fura-fila: só quando habilitado nas settings do merchant. */}
        {settings.furaFilaEnabled && (
          <Pressable accessibilityRole="button" style={styles.furaCta} onPress={handleFuraFila}>
            <FuraFilaIcon width={20} height={20} color={colors.accent} />
            <Text style={styles.furaCtaText}>Furar a fila</Text>
            <Text style={styles.furaCtaPrice}>{formatBRL(settings.furaFilaPriceCents)}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
};

export default MerchantProfileScreen;

/** Métricas decorativas do topo (não fazem parte do domínio da fila). */
const KPIS = [
  { label: 'Agendamentos', value: '1.2k' },
  { label: 'Avaliações', value: '897' },
  { label: 'Indicações', value: '320' },
  { label: 'Novos clientes', value: '58' },
] as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 22,
    color: colors.white,
    textAlign: 'center',
  },
  category: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.contentLight,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    columnGap: 4,
  },
  ratingValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: colors.white,
  },
  ratingCount: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: colors.contentLight,
  },
  priceLevel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: colors.contentLight,
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 20,
    columnGap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  kpiValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  kpiLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: colors.textPrimary,
  },
  infoTitleSpaced: {
    marginTop: 12,
  },
  infoText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  serviceCard: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  serviceName: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  serviceMeta: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  servicePrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: colors.brand,
  },
  queueCard: {
    marginHorizontal: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  queueCount: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  queueWait: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  primaryCta: {
    marginHorizontal: 16,
    marginTop: 20,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaDisabled: {
    backgroundColor: colors.disabled,
  },
  primaryCtaText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.white,
  },
  furaCta: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  furaCtaText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: colors.accent,
  },
  furaCtaPrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: colors.accent,
  },
});
