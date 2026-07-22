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
import { useToast } from '../ui/ToastProvider';
import { Icon } from '../ui/Icon';
import type { PixKey, PixKeyType, WithdrawQuote } from '../../lib/services/types';
import { formatBRL } from '../../lib/formatters';
import { colors } from '../../lib/theme';

// Rótulo pt-BR por tipo de chave Pix (mapeamento local porque aqui as linhas
// são SELECIONÁVEIS, não apenas exibição — mesmo racional do withdraw F3).
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
// validação da CTA continua sendo a fonte da verdade.
const QUICK_AMOUNTS_CENTS = [5000, 10000] as const;

// Remove tudo que não for dígito.
function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

// Exibe centavos como "79,09" — SEM o prefixo, que no layout 🆕 é um Text "R$"
// fixo ao lado do input (difere do withdraw F3, que embutia o prefixo no valor).
function formatAmountDigits(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export interface WithdrawFlowProps {
  /** "Saldo disponível" (Financeiro) | "Saldo Cashback" (QI). */
  heroLabel: string;
  balanceCents: number;
  pixKeys: PixKey[];
  /**
   * Cotação (taxa/total/ETA) do domínio do chamador — recalculada a cada valor
   * válido. Lida por ref internamente, então NÃO precisa ser memoizada: mudar a
   * identidade da função entre renders não redispara a cotação.
   */
  quote: (amountCents: number) => Promise<WithdrawQuote>;
  onConfirm: (amountCents: number, pixKeyId: string) => Promise<void>;
  /** Rota de cadastro de nova chave do chamador. */
  onAddPixKey: () => void;
  /** Fechamento do modal de sucesso (tipicamente `router.back()`). */
  onSuccessClose: () => void;
  /** Valor mínimo de saque em centavos (QI passa 3000); omitido = sem mínimo (Financeiro). */
  minWithdrawCents?: number;
  testID?: string;
}

/**
 * Fluxo de saque COMPARTILHADO (F4 — QI, Task 4; Figma 🆕 `2715:3711`).
 * Consumido pelo withdraw do Financeiro (Task 5) e pelos withdraws do QI
 * cliente/lojista (Task 12) — a lógica visual/estados veio do withdraw F3.
 *
 * Agnóstico de domínio: NÃO usa serviços nem router — saldo/chaves entram por
 * props e `quote`/`onConfirm`/`onAddPixKey`/`onSuccessClose` são delegados ao
 * chamador. Só o `useToast()` (provider de AMBIENTE, não de domínio) é
 * consumido aqui, para o toast de erro do submit (padrão F3).
 *
 * Estrutura (Figma 🆕): hero navy com o saldo · input de valor em centavos (os
 * dígitos digitados SÃO os centavos → exibe "79,09" com prefixo "R$" fixo) ·
 * chips R$ 50 / R$ 100 / Tudo · chaves Pix selecionáveis (single-select) +
 * botão outline "+ Adicionar chave Pix" · "Resumo da transferência"
 * (Valor / Taxa de operação / Tempo estimado / Total a receber, da cotação
 * assíncrona — só aparece com valor > 0) · banner verde de isenção · CTA
 * "Confirmar saque" → overlay de loading → modal de sucesso.
 *
 * CTA desabilitada se valor ≤ 0, valor > saldo, valor < mínimo (quando há),
 * nenhuma chave selecionada ou já submetendo. Sem chaves → empty state com CTA
 * para `onAddPixKey`. Rejeição do `onConfirm` → toast e volta ao formulário.
 *
 * DIVERGÊNCIAS deliberadas do Figma 🆕 2715:3711 (documentadas p/ o revisor):
 * sem a top bar (hambúrguer) nem o botão "Cancelar saque" — navegação é do
 * chamador (as telas usam o header "Voltar", convenção de sub-tela); sem o
 * aviso azul de mínimo "R$ 50,00" (o mínimo REAL varia por chamador via
 * `minWithdrawCents` — QI R$ 30,00, Financeiro sem mínimo — e exibir o texto
 * estático sugeriria regra não aplicada); e a CTA segue o rótulo da
 * especificação ("Confirmar saque"), não "Solicitar saque".
 */
export const WithdrawFlow: React.FC<WithdrawFlowProps> = ({
  heroLabel,
  balanceCents,
  pixKeys,
  quote,
  onConfirm,
  onAddPixKey,
  onSuccessClose,
  minWithdrawCents,
  testID,
}) => {
  const { showError } = useToast();

  const [amountCents, setAmountCents] = useState(0);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  // Cotação corrente (null = sem valor válido ou ainda em voo → resumo oculto).
  const [quoteResult, setQuoteResult] = useState<WithdrawQuote | null>(null);

  // Guarda de montagem para os setState assíncronos do submit (o chamador pode
  // desmontar a tela durante o onConfirm) — evita setState após unmount.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  // `quote` lida por ref: assim o efeito depende só de `amountCents` e um
  // chamador que passe uma arrow inline (identidade nova a cada render) não
  // dispara um loop de re-cotação.
  const quoteRef = useRef(quote);
  quoteRef.current = quote;

  // Recalcula a cotação a cada mudança de valor VÁLIDO (> 0); valor zerado
  // limpa o resumo. `active`-guard descarta respostas fora de ordem quando o
  // usuário digita mais rápido que a cotação resolve.
  useEffect(() => {
    if (amountCents <= 0) {
      setQuoteResult(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const result = await quoteRef.current(amountCents);
        if (active) setQuoteResult(result);
      } catch {
        // Cotação indisponível → resumo oculto (a CTA não depende da cotação).
        if (active) setQuoteResult(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [amountCents]);

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

  // Fechar o modal de sucesso devolve o controle ao chamador (ex.: router.back()).
  const handleDone = useCallback(() => {
    setSuccessVisible(false);
    onSuccessClose();
  }, [onSuccessClose]);

  const disabled =
    amountCents <= 0 ||
    amountCents > balanceCents ||
    (minWithdrawCents !== undefined && amountCents < minWithdrawCents) ||
    !selectedKey ||
    submitting;

  // Confirma o saque: guarda contra duplo-submit/submit inválido; mostra o
  // overlay de carregamento; no sucesso abre o modal; na falha erra por toast e
  // volta ao formulário. `finally` destrava o submit (com guarda de montagem).
  const handleConfirm = useCallback(async () => {
    if (disabled) return;
    // `selectedKey` é garantido não-nulo por `disabled`, mas checamos p/ o TS.
    if (!selectedKey) return;
    setSubmitting(true);
    try {
      await onConfirm(amountCents, selectedKey.id);
      if (mountedRef.current) setSuccessVisible(true);
    } catch {
      if (mountedRef.current) {
        showError('Não foi possível solicitar o saque. Tente novamente.');
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [disabled, selectedKey, amountCents, onConfirm, showError]);

  const hasKeys = pixKeys.length > 0;
  // Resumo só com valor > 0 E cotação resolvida (evita card vazio/obsoleto).
  const showSummary = amountCents > 0 && quoteResult !== null;

  return (
    <View style={styles.container} testID={testID}>
      {/* Hero navy: rótulo do chamador + saldo. */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{heroLabel}</Text>
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
        {/* Valor a resgatar — input em centavos com prefixo "R$" fixo. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quanto deseja resgatar?</Text>
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Valor</Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountPrefix}>R$</Text>
              <TextInput
                testID="input-amount"
                accessibilityLabel="Valor do saque"
                style={styles.amountInput}
                value={amountCents > 0 ? formatAmountDigits(amountCents) : ''}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor={colors.textMuted}
              />
            </View>
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

        {/* Chaves Pix — lista SELECIONÁVEL (single-select) + adicionar. */}
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
            <Text style={styles.emptyText}>
              Você ainda não cadastrou uma chave Pix para receber o saque.
            </Text>
          )}

          <Pressable
            testID="btn-add-pix"
            accessibilityRole="button"
            accessibilityLabel="Adicionar chave Pix"
            style={styles.outlineButton}
            onPress={onAddPixKey}
          >
            <Text style={styles.outlineButtonText}>+ Adicionar chave Pix</Text>
          </Pressable>
        </View>

        {/* Resumo da transferência (🆕) — da cotação do chamador. */}
        {showSummary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo da transferência</Text>
            <View style={styles.summaryCard} testID="withdraw-summary">
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Valor</Text>
                <Text style={styles.summaryValue} testID="summary-amount">
                  {formatBRL(quoteResult.amountCents)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Taxa de operação</Text>
                <Text style={styles.summaryValue} testID="summary-fee">
                  {formatBRL(quoteResult.feeCents)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                {/* Rótulo em accent (surface/error no Figma), único da coluna. */}
                <Text style={styles.summaryLabelAccent}>Tempo estimado</Text>
                <Text style={styles.summaryValue} testID="summary-eta">
                  {quoteResult.etaLabel}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTotalLabel}>Total a receber</Text>
                <Text style={styles.summaryTotalValue} testID="summary-total">
                  {formatBRL(quoteResult.totalCents)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Banner de isenção — texto ESTÁTICO do Figma; o limiar de R$ 200,00
            espelha FEE_FREE_THRESHOLD_CENTS de lib/services/mock/withdrawQuote.ts
            (régua única compartilhada pelos domínios Wallet e QI). */}
        <View style={styles.notice}>
          <Icon name="check-circle" size={20} color={colors.surfaceSuccess} />
          <View style={styles.noticeBody}>
            <Text style={styles.noticeTitle}>Saques sem taxa</Text>
            <Text style={styles.noticeText}>
              Saques acima de R$ 200,00 não pagam taxas de retirada
            </Text>
          </View>
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

      {/* Estado de carregamento em tela cheia (padrão F3) enquanto submete. */}
      {submitting ? (
        <View style={styles.submittingOverlay} testID="withdraw-loading">
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.submittingText}>Por favor, aguarde.....</Text>
        </View>
      ) : null}

      {/* Modal de sucesso (padrão F3) — check + "Saque solicitado". */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  amountPrefix: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textSecondary,
  },
  amountInput: {
    flex: 1,
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
  // ── Resumo da transferência (🆕) ─────────────────────────
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    rowGap: 8,
    // drop-shadow do Figma (0 4 6 @10%); elevation p/ Android.
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryLabelAccent: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.accent,
  },
  summaryValue: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.surfaceGrey,
  },
  summaryTotalLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryTotalValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.surfaceSuccess,
  },
  // ── Banner de isenção (verde) ────────────────────────────
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    backgroundColor: colors.surfaceSuccessLight,
    borderRadius: 4,
    padding: 12,
  },
  noticeBody: {
    flex: 1,
    rowGap: 4,
  },
  noticeTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.textPrimary,
  },
  noticeText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.textPrimary,
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
