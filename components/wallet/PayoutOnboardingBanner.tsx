import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useWalletService } from '../../context/ServicesContext';
import { Icon } from '../ui/Icon';
import type { PayoutAccountStatus } from '../../lib/services/types';
import { colors } from '../../lib/theme';

/** Deep link para onde o `connect-return` redireciona ao fim do formulário. */
const RETURN_URL = 'walltoall://financeiro';

const OPEN_ERROR = 'Não foi possível abrir a ativação. Tente novamente.';

export interface PayoutOnboardingBannerProps {
  status: PayoutAccountStatus;
  /** Chamado na volta do formulário (concluído ou não): o pai relê o status. */
  onReturn: () => void | Promise<void>;
  testID?: string;
}

/**
 * Aviso "Ative seus recebimentos" do lojista (F8, Task 15).
 *
 * Some com a conta `active`. Senão, o CTA pede o link do formulário hospedado
 * (`startPayoutOnboarding`), abre numa sessão de navegador que fecha quando o
 * `connect-return` redireciona para `walltoall://financeiro` e, na volta, chama
 * `onReturn` (mesmo se o lojista fechou antes: ele pode ter avançado no
 * cadastro). Falha ao gerar o link vira mensagem inline.
 *
 * DIVERGÊNCIA: não há node no Figma para este aviso. Segue o padrão de aviso do
 * app com os tokens existentes: card claro, ícone de alerta, título bold e CTA
 * outline navy (radius 24).
 */
export const PayoutOnboardingBanner: React.FC<PayoutOnboardingBannerProps> = ({
  status,
  onReturn,
  testID = 'payout-banner',
}) => {
  const walletService = useWalletService();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openingRef = useRef(false);

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const handleActivate = useCallback(async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError(null);
    try {
      let url: string;
      try {
        ({ url } = await walletService.startPayoutOnboarding());
      } catch {
        if (mountedRef.current) setError(OPEN_ERROR);
        return;
      }
      await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
      await onReturn();
    } catch {
      if (mountedRef.current) setError(OPEN_ERROR);
    } finally {
      openingRef.current = false;
      if (mountedRef.current) setOpening(false);
    }
  }, [walletService, onReturn]);

  if (status === 'active') return null;

  const body =
    status === 'pending'
      ? 'Seu cadastro de recebimento está incompleto. Finalize para poder sacar seu saldo.'
      : 'Cadastre sua conta de recebimento para poder sacar seu saldo.';

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.row}>
        <Icon name="error-outline" size={24} color={colors.contentWarning} />
        <View style={styles.texts}>
          <Text style={styles.title}>Ative seus recebimentos</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        testID="btn-activate-payouts"
        accessibilityRole="button"
        accessibilityLabel="Ativar recebimentos"
        accessibilityState={{ disabled: opening, busy: opening }}
        disabled={opening}
        style={[styles.cta, opening && styles.ctaDisabled]}
        onPress={handleActivate}
      >
        {opening ? <ActivityIndicator size="small" color={colors.brand} /> : null}
        <Text style={styles.ctaText}>Ativar recebimentos</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  texts: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  error: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.error,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
});
