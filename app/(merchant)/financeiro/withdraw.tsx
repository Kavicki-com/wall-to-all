// F3: dados 100% do WalletService mock; a unificação com o backend é F8.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletService } from '../../../context/ServicesContext';
import { useToast } from '../../../components/ui/ToastProvider';
import { Icon } from '../../../components/ui/Icon';
import type { PixKey, PixKeyType } from '../../../lib/services/types';
import { formatBRL } from '../../../lib/formatters';
import { colors } from '../../../lib/theme';

// Rótulo pt-BR por tipo de chave Pix (mesma ideia da PixKeySection — mapeamento
// local porque aqui as linhas são SELECIONÁVEIS, não apenas exibição).
const TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Aleatória',
};

// Teto de dígitos do valor: até R$ 9.999.999,99 (evita overflow ao digitar).
const MAX_AMOUNT_DIGITS = 9;

// Atalhos de valor (em centavos) do Figma 🆕 2715:3711 — "R$ 50" e "R$ 100"
// (o "Tudo" usa o saldo inteiro). São apenas conveniência: preenchem o valor; a
// validação da CTA (valor > 0 e ≤ saldo) continua sendo a fonte da verdade.
const QUICK_AMOUNTS_CENTS = [5000, 10000] as const;

// Remove tudo que não for dígito.
function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/**
 * Solicitar Saque do LOJISTA (F3 — Carteira/Financeiro, Task 9; Figma 🆕
 * `2715:3711` saque, `2622:5836` loading, `2622:5847` modal de sucesso).
 *
 * Sub-tela navegável (empilhada a partir do Financeiro): usa o "Voltar" fantasma
 * (mesma convenção da F1 e do cadastro de cartão), sem a top bar navy. No mount
 * carrega saldo + chaves Pix em paralelo (guarda `active`, `loaded` segura o
 * spinner). Mostra o saldo disponível num hero navy, um input de VALOR em
 * centavos (os dígitos digitados SÃO os centavos → exibe `formatBRL`), atalhos de
 * valor, uma lista SELECIONÁVEL das chaves Pix (single-select) e a CTA "Confirmar
 * saque".
 *
 * A CTA fica desabilitada enquanto valor ≤ 0, valor > saldo, nenhuma chave
 * selecionada ou já submetendo. Ao confirmar: mostra o estado de carregamento
 * ("Por favor, aguarde....."), chama `requestWithdraw` e — no sucesso — abre o
 * modal "Saque solicitado" (cujo fechar volta); na falha, erra por toast e
 * volta ao formulário. Guarda de montagem no handler assíncrono + guarda contra
 * duplo-submit.
 *
 * DIVERGÊNCIAS deliberadas do Figma 🆕 2715:3711 (documentadas para o revisor):
 * usamos o header "Voltar" (convenção de sub-tela) em vez da top bar com
 * hambúrguer; omitimos o "Resumo da transferência" (taxa/total) e os avisos de
 * taxa/mínimo porque o `requestWithdraw` do mock debita exatamente o valor, SEM
 * taxa nem regra de mínimo — exibi-los sugeriria regras não aplicadas; e a CTA
 * segue o rótulo da especificação ("Confirmar saque"), não "Solicitar saque".
 */
const WithdrawScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const walletService = useWalletService();
  const { showError } = useToast();

  const [loaded, setLoaded] = useState(false);
  const [balanceCents, setBalanceCents] = useState(0);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);

  const [amountCents, setAmountCents] = useState(0);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  // Guarda de montagem para os setState assíncronos (o usuário pode voltar
  // durante o load ou o submit) — evita setState após unmount.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

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

  const selectedKey = useMemo(
    () => pixKeys.find((key) => key.id === selectedKeyId) ?? null,
    [pixKeys, selectedKeyId],
  );

  // Input de valor em CENTAVOS: os dígitos digitados SÃO os centavos. Extraímos
  // todos os dígitos do texto atual (o padrão clássico funciona porque cada
  // tecla acrescenta um dígito ao fim) e reinterpretamos como centavos.
  const handleAmountChange = useCallback((text: string) => {
    const digits = onlyDigits(text).slice(0, MAX_AMOUNT_DIGITS);
    setAmountCents(digits ? parseInt(digits, 10) : 0);
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Fechar o modal de sucesso volta para o Financeiro (que recarrega ao focar).
  const handleDone = useCallback(() => {
    setSuccessVisible(false);
    router.back();
  }, [router]);

  const disabled =
    amountCents <= 0 || amountCents > balanceCents || !selectedKeyId || submitting;

  // Confirma o saque: guarda contra duplo-submit/submit inválido; mostra o estado
  // de carregamento; no sucesso abre o modal; na falha erra por toast e volta ao
  // formulário. `finally` destrava o submit (com guarda de montagem).
  const handleConfirm = useCallback(async () => {
    if (disabled) return;
    // `selectedKeyId` é garantido não-nulo por `disabled`, mas checamos p/ o TS.
    if (!selectedKeyId) return;
    setSubmitting(true);
    try {
      await walletService.requestWithdraw(amountCents, selectedKeyId);
      if (mountedRef.current) setSuccessVisible(true);
    } catch {
      if (mountedRef.current) {
        showError('Não foi possível solicitar o saque. Tente novamente.');
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [disabled, selectedKeyId, amountCents, walletService, showError]);

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const hasKeys = pixKeys.length > 0;

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

      {/* Hero navy: saldo disponível. */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Saldo disponível</Text>
        <Text style={styles.heroBalance} testID="withdraw-balance">
          {formatBRL(balanceCents)}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Valor a resgatar — input em centavos (exibe formatBRL). */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quanto deseja resgatar?</Text>
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Valor</Text>
            <TextInput
              testID="input-amount"
              accessibilityLabel="Valor do saque"
              style={styles.amountInput}
              value={formatBRL(amountCents)}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              placeholder="R$ 0,00"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Atalhos de valor (Figma 🆕): R$ 50, R$ 100 e "Tudo" (saldo). */}
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS_CENTS.map((cents) => {
              const selected = amountCents === cents;
              return (
                <Pressable
                  key={cents}
                  testID={`quick-amount-${cents}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Definir valor ${formatBRL(cents)}`}
                  accessibilityState={{ selected }}
                  hitSlop={HIT_SLOP}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setAmountCents(cents)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {formatBRL(cents).replace(',00', '')}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              testID="quick-amount-all"
              accessibilityRole="button"
              accessibilityLabel="Definir valor com todo o saldo"
              accessibilityState={{ selected: balanceCents > 0 && amountCents === balanceCents }}
              hitSlop={HIT_SLOP}
              style={[
                styles.chip,
                balanceCents > 0 && amountCents === balanceCents && styles.chipSelected,
              ]}
              onPress={() => setAmountCents(balanceCents)}
            >
              <Text
                style={[
                  styles.chipText,
                  balanceCents > 0 && amountCents === balanceCents && styles.chipTextSelected,
                ]}
              >
                Tudo
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Chaves Pix — lista SELECIONÁVEL (single-select). */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chaves Pix</Text>

          {hasKeys ? (
            pixKeys.map((key) => {
              const selected = key.id === selectedKeyId;
              return (
                <Pressable
                  key={key.id}
                  testID={`pix-option-${key.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Chave Pix ${TYPE_LABELS[key.type]} ${key.maskedValue}`}
                  accessibilityState={{ selected }}
                  style={[styles.pixOption, selected && styles.pixOptionSelected]}
                  onPress={() => setSelectedKeyId(key.id)}
                >
                  <Text style={styles.pixOptionLabel}>{TYPE_LABELS[key.type]}</Text>
                  <Text style={styles.pixOptionValue} numberOfLines={1}>
                    {key.maskedValue}
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <>
              <Text style={styles.emptyText}>
                Você ainda não cadastrou uma chave Pix para receber o saque.
              </Text>
              <Pressable
                testID="btn-register-pix"
                accessibilityRole="button"
                accessibilityLabel="Cadastrar chave Pix"
                style={styles.outlineButton}
                onPress={() => router.push('/(merchant)/financeiro/new-pix-key')}
              >
                <Text style={styles.outlineButtonText}>Cadastrar chave Pix</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* CTA "Confirmar saque" — navy, radius 24. */}
        <Pressable
          testID="btn-confirm-withdraw"
          accessibilityRole="button"
          accessibilityLabel="Confirmar saque"
          accessibilityState={{ disabled }}
          disabled={disabled}
          style={[styles.confirmButton, disabled && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmButtonText}>Confirmar saque</Text>
        </Pressable>
      </ScrollView>

      {/* Estado de carregamento em tela cheia (Figma 2622:5836) enquanto submete. */}
      {submitting ? (
        <View style={styles.submittingOverlay} testID="withdraw-loading">
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.submittingText}>Por favor, aguarde.....</Text>
        </View>
      ) : null}

      {/* Modal de sucesso (Figma 2622:5847) — check + "Saque solicitado". */}
      {successVisible ? (
        <Modal visible transparent animationType="fade" onRequestClose={handleDone}>
          <View style={styles.modalRoot}>
            <View style={styles.modalCard} accessibilityViewIsModal testID="withdraw-success">
              <Icon name="check-circle" size={40} color={colors.surfaceSuccess} />
              <Text accessibilityRole="header" style={styles.modalTitle}>
                Saque solicitado
              </Text>
              <Text style={styles.modalBody}>
                Seu saque foi solicitado com sucesso, aguarde o prazo e verifique sua conta.
              </Text>
              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryText}>
                  Valor: <Text style={styles.modalSummaryStrong}>{formatBRL(amountCents)}</Text>
                </Text>
                {selectedKey ? (
                  <Text style={styles.modalSummaryText}>
                    Chave Pix:{' '}
                    <Text style={styles.modalSummaryStrong}>
                      {TYPE_LABELS[selectedKey.type]} {selectedKey.maskedValue}
                    </Text>
                  </Text>
                ) : null}
              </View>
              <Pressable
                testID="btn-withdraw-done"
                accessibilityRole="button"
                accessibilityLabel="Concluir"
                style={styles.modalButton}
                onPress={handleDone}
              >
                <Text style={styles.modalButtonText}>Concluir</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
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
  // ── Hero navy (saldo) ────────────────────────────────────
  hero: {
    backgroundColor: colors.brand,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 4,
  },
  heroLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.contentLight,
  },
  heroBalance: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 32,
    color: colors.contentPrimaryLight,
  },
  // ── Corpo ────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    rowGap: 24,
  },
  section: {
    rowGap: 16,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
  },
  // ── Input de valor ───────────────────────────────────────
  amountCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    rowGap: 4,
  },
  amountLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  amountInput: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 32,
    color: colors.textPrimary,
    padding: 0,
  },
  // ── Atalhos de valor ─────────────────────────────────────
  quickRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: colors.brand,
  },
  chipText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.brand,
  },
  chipTextSelected: {
    color: colors.contentLight,
  },
  // ── Opções de chave Pix (selecionáveis) ──────────────────
  pixOption: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    rowGap: 4,
  },
  pixOptionSelected: {
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.surfacePrimaryExtraLight,
  },
  pixOptionLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  pixOptionValue: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  outlineButton: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  // ── CTA "Confirmar saque" ────────────────────────────────
  confirmButton: {
    height: 52,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  // ── Overlay de carregamento (submit) ─────────────────────
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 16,
  },
  submittingText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  // ── Modal de sucesso ─────────────────────────────────────
  modalRoot: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    rowGap: 16,
  },
  modalTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.surfaceSuccess,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalSummary: {
    width: '100%',
    rowGap: 4,
  },
  modalSummaryText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalSummaryStrong: {
    fontFamily: 'Montserrat_700Bold',
  },
  modalButton: {
    height: 52,
    width: '100%',
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
});
