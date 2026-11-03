import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletService } from '../../../context/ServicesContext';
import { WithdrawFlow } from '../../../components/wallet/WithdrawFlow';
import { PayoutOnboardingBanner } from '../../../components/wallet/PayoutOnboardingBanner';
import { Icon } from '../../../components/ui/Icon';
import { handleError } from '../../../lib/errorHandler';
import { newCheckoutKey } from '../../../lib/payments/checkoutKey';
import type { PayoutAccountStatus, PixKey } from '../../../lib/services/types';
import { colors } from '../../../lib/theme';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/** Corpo do estado de erro (a tela sempre oferece o "Voltar" e o retry). */
const LOAD_ERROR_MESSAGE = 'Não foi possível carregar os dados do saque.';

interface WithdrawData {
  balanceCents: number;
  pixKeys: PixKey[];
  payoutStatus: PayoutAccountStatus;
}

/**
 * Solicitar Saque do LOJISTA (F3; Figma 🆕 `2715:3711`), F8 Task 15.
 *
 * CASCA FINA: dona da carga e da navegação; formulário, resumo e modal vivem no
 * `WithdrawFlow` compartilhado. O Financeiro não tem valor mínimo de saque; a
 * cotação aplica a taxa de R$ 5,00 abaixo de R$ 200,00.
 *
 * Carga (saldo, chaves Pix e conta de recebimento) ao FOCAR, no mesmo idioma do
 * `QiWithdrawScreen`: `load` memoizada, chamada pelo efeito e pelo "Tentar
 * novamente", com token monotônico (`runIdRef`) contra corrida. Falha no
 * primeiro load vira estado de erro com retry (fecha o débito F3 do spinner
 * infinito); num refoco os últimos dados bons ficam na tela. O "Voltar" aparece
 * nos quatro estados (carga, erro, bloqueado e formulário).
 *
 * Conta de recebimento não ativa: formulário bloqueado, só o aviso com o CTA de
 * ativação (o servidor recusaria com `payout_account_inactive`).
 *
 * Idempotência: uma chave `chk_` por tentativa de saque, presa a (valor, chave
 * Pix). Retry depois de falha com os mesmos dados reusa a chave (o servidor
 * retoma o saque em vez de criar outro); mudar o valor ou a chave Pix gera uma
 * chave nova; sucesso descarta a chave.
 */
const WithdrawScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const walletService = useWalletService();

  const [loaded, setLoaded] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [data, setData] = useState<WithdrawData | null>(null);

  const runIdRef = useRef(0);
  const attemptRef = useRef<{ signature: string; key: string } | null>(null);

  const load = useCallback(async () => {
    const runId = ++runIdRef.current;
    try {
      const [balanceCents, pixKeys, payoutStatus] = await Promise.all([
        walletService.getMerchantBalanceCents(),
        walletService.getPixKeys(),
        walletService.getPayoutAccountStatus(),
      ]);
      if (runIdRef.current !== runId) return;
      setData({ balanceCents, pixKeys, payoutStatus });
    } catch (error) {
      // No primeiro load `data` fica nulo e o gate mostra o estado de erro; num
      // refoco os dados anteriores seguem e a falha só é registrada.
      handleError(error, 'general');
    } finally {
      if (runIdRef.current === runId) {
        setLoaded(true);
        setReloading(false);
      }
    }
  }, [walletService]);

  // Recarrega ao FOCAR (mount inclusive): ao voltar do cadastro de chave Pix a
  // tela segue montada e só o refoco reflete a chave nova.
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        runIdRef.current++;
      };
    }, [load]),
  );

  const handleRetry = useCallback(() => {
    if (reloading) return;
    setReloading(true);
    void load();
  }, [load, reloading]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleConfirm = useCallback(
    async (amountCents: number, pixKeyId: string) => {
      const signature = `${amountCents}:${pixKeyId}`;
      if (attemptRef.current?.signature !== signature) {
        attemptRef.current = { signature, key: newCheckoutKey() };
      }
      await walletService.requestWithdraw(amountCents, pixKeyId, attemptRef.current.key);
      attemptRef.current = null;
    },
    [walletService],
  );

  const header = (
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
  );

  let body: React.ReactNode;
  if (!loaded) {
    body = (
      <View style={styles.stateCenter}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  } else if (!data) {
    body = (
      <View style={styles.stateCenter}>
        <Text style={styles.errorText}>{LOAD_ERROR_MESSAGE}</Text>
        <Pressable
          testID="btn-retry"
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
          accessibilityState={{ disabled: reloading, busy: reloading }}
          disabled={reloading}
          style={[styles.retryButton, reloading && styles.retryButtonDisabled]}
          onPress={handleRetry}
        >
          {reloading && <ActivityIndicator size="small" color={colors.contentLight} />}
          <Text style={styles.retryText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  } else if (data.payoutStatus !== 'active') {
    body = (
      <View style={styles.blocked}>
        <PayoutOnboardingBanner status={data.payoutStatus} onReturn={load} />
      </View>
    );
  } else {
    body = (
      <WithdrawFlow
        heroLabel="Saldo disponível"
        balanceCents={data.balanceCents}
        pixKeys={data.pixKeys}
        quote={(cents) => walletService.quoteWithdraw(cents)}
        onConfirm={handleConfirm}
        onAddPixKey={() => router.push('/(merchant)/financeiro/new-pix-key')}
        onSuccessClose={handleBack}
      />
    );
  }

  return (
    <View style={styles.container}>
      {header}
      {body}
    </View>
  );
};

export default WithdrawScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  // ── Estados de carga, erro e bloqueio ────────────────────
  stateCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  errorText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.brand,
  },
  retryButtonDisabled: {
    opacity: 0.5,
  },
  retryText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  blocked: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
