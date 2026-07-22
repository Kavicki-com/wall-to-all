// F3: dados 100% do WalletService mock; a unificação com o backend é F8.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletService } from '../../../context/ServicesContext';
import { WithdrawFlow } from '../../../components/wallet/WithdrawFlow';
import { Icon } from '../../../components/ui/Icon';
import type { PixKey } from '../../../lib/services/types';
import { colors } from '../../../lib/theme';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/**
 * Solicitar Saque do LOJISTA (F3 — Carteira/Financeiro; Figma 🆕 `2715:3711`).
 *
 * WRAPPER FINO: dono do carregamento de dados e da navegação; a UI de
 * formulário/resumo/modal vive no `WithdrawFlow` compartilhado (F4, Task 4).
 * No mount carrega saldo + chaves Pix em paralelo (guarda `active`, `loaded`
 * segura o spinner). Renderiza o header "Voltar" fantasma (afordância de
 * navegação da sub-tela, que o `WithdrawFlow` deliberadamente omite) acima do
 * fluxo. O Financeiro NÃO tem valor mínimo de saque, então `minWithdrawCents`
 * é omitido; a cotação (`quoteWithdraw`) aplica a taxa de R$ 5,00 abaixo de
 * R$ 200,00 (isento a partir daí) — o "Resumo da transferência" do fluxo fecha
 * a dívida de fidelidade da taxa que o F3 havia adiado.
 */
const WithdrawScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const walletService = useWalletService();

  const [loaded, setLoaded] = useState(false);
  const [balanceCents, setBalanceCents] = useState(0);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);

  // Carrega saldo + chaves Pix em paralelo no mount; `active`-guard evita
  // setState após desmontar; `loaded` segura o spinner só no primeiro load.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [balanceResult, pixResult] = await Promise.all([
          walletService.getMerchantBalanceCents(),
          walletService.getPixKeys(),
        ]);
        if (!active) return;
        setBalanceCents(balanceResult);
        setPixKeys(pixResult);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [walletService]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header: "Voltar" fantasma (afordância real de navegação — sub-tela). */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          testID="btn-back"
          hitSlop={HIT_SLOP}
          style={styles.backButton}
          onPress={handleBack}
        >
          <Icon name="chevron-left" size={24} color={colors.brand} />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
      </View>

      <WithdrawFlow
        heroLabel="Saldo disponível"
        balanceCents={balanceCents}
        pixKeys={pixKeys}
        quote={(cents) => walletService.quoteWithdraw(cents)}
        onConfirm={(cents, keyId) => walletService.requestWithdraw(cents, keyId)}
        onAddPixKey={() => router.push('/(merchant)/financeiro/new-pix-key')}
        onSuccessClose={() => router.back()}
      />
    </View>
  );
};

export default WithdrawScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  // ── Header ───────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 16,
    color: colors.brand,
  },
});
