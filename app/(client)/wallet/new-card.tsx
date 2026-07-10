import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletService } from '../../../context/ServicesContext';
import { Icon } from '../../../components/ui/Icon';
import { CustomInput } from '../../../components/ui/CustomInput';
import { CreditCard } from '../../../components/payment/CreditCard';
import { useToast } from '../../../components/ui/ToastProvider';
import type { CardBrand, PaymentCard } from '../../../lib/services/types';
import { colors } from '../../../lib/theme';

// ── Helpers de máscara/derivação (sem lib nova — formatação manual) ─────────

/** Remove tudo que não for dígito. */
function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

/** Agrupa os dígitos do número em blocos de 4: "4111111111111111" → "4111 1111 1111 1111". */
function formatCardNumber(digits: string): string {
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/** Formata os dígitos de validade como "MM/AA" (só insere a barra após 2 dígitos). */
function formatExpiry(digits: string): string {
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * Deriva a bandeira pelo PRIMEIRO dígito do número — espelha o `deriveCardBrand`
 * do mock (não exportado para telas): 4 → Visa, 5 → Mastercard, 3 → Amex, senão
 * Elo. Usado só para o preview refletir a bandeira ao vivo enquanto se digita.
 */
function derivePreviewBrand(digits: string): CardBrand {
  switch (digits[0]) {
    case '4':
      return 'visa';
    case '5':
      return 'mastercard';
    case '3':
      return 'amex';
    default:
      return 'elo';
  }
}

/**
 * Valida a validade `MM/AA` (decisão #4 do plano — SEM Luhn): exige 4 dígitos,
 * mês 01-12 e a competência (mês/ano) no FUTURO. Um cartão que vence NESTE mês
 * ainda é válido (comparação por ano+mês, não por dia). Retorna a mensagem de
 * erro pt-BR ou `undefined` quando válido.
 */
function validateExpiry(digits: string): string | undefined {
  if (digits.length !== 4) return 'Validade inválida';
  const month = parseInt(digits.slice(0, 2), 10);
  const year = 2000 + parseInt(digits.slice(2), 10);
  if (month < 1 || month > 12) return 'Validade inválida';
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() é 0-based
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return 'Cartão vencido';
  }
  return undefined;
}

type FieldKey = 'number' | 'holderName' | 'expiry' | 'cvv';

/**
 * Cadastro de novo cartão do cliente (Figma node 2660:6604).
 *
 * Sub-tela navegável: usa o "Voltar" fantasma (mesma convenção da F1 —
 * settings do Aqui e Agora), sem a top bar navy do Figma. Mostra um preview ao
 * vivo do `CreditCard` (F0) refletindo número/nome/bandeira digitados, quatro
 * campos com máscara manual (número `0000 0000 0000 0000`, nome, validade
 * `MM/AA`, CVV) e a CTA "Salvar cartão".
 *
 * Validação leve (decisão #4 do plano — SEM Luhn), com erros pt-BR inline por
 * campo no estilo dos formulários de signup (mostrados no blur). A CTA fica
 * desabilitada enquanto o formulário é inválido OU está salvando. No sucesso,
 * `addCard` persiste no mock, dispara o toast e volta; a falha erra por toast.
 * Guarda de montagem no handler assíncrono (o usuário pode voltar durante o
 * save) + guarda contra duplo-submit.
 */
const NewCardScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const walletService = useWalletService();
  const { showSuccess, showError } = useToast();

  // Estado controlado — números guardam os dígitos CRUS; a exibição é mascarada.
  const [number, setNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  // Campos "tocados" (blur) — só então o erro do campo aparece (estilo signup).
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [saving, setSaving] = useState(false);

  // Guarda de montagem para o setState assíncrono do save (o handler não faz
  // parte de um efeito; evita setState após unmount ao voltar durante o save).
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  // Erros por campo (recalculados a cada render — baratos). `undefined` = válido.
  const errors = useMemo(
    () => ({
      number: number.length === 16 ? undefined : 'Número do cartão inválido',
      holderName: holderName.trim().length > 0 ? undefined : 'Informe o nome no cartão',
      expiry: validateExpiry(expiry),
      cvv: cvv.length >= 3 && cvv.length <= 4 ? undefined : 'CVV inválido',
    }),
    [number, holderName, expiry, cvv],
  );

  const isValid = !errors.number && !errors.holderName && !errors.expiry && !errors.cvv;

  // Cartão de preview: reflete bandeira (1º dígito), nome e últimos 4 ao vivo.
  const previewCard: PaymentCard = useMemo(
    () => ({
      id: 'preview',
      brand: derivePreviewBrand(number),
      last4: number.slice(-4) || '0000',
      holderName: holderName || 'NOME DO TITULAR',
      expiry: formatExpiry(expiry),
      isDefault: false,
    }),
    [number, holderName, expiry],
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const markTouched = useCallback((field: FieldKey) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleNumberChange = useCallback((text: string) => {
    setNumber(onlyDigits(text).slice(0, 16));
  }, []);

  const handleExpiryChange = useCallback((text: string) => {
    setExpiry(onlyDigits(text).slice(0, 4));
  }, []);

  const handleCvvChange = useCallback((text: string) => {
    setCvv(onlyDigits(text).slice(0, 4));
  }, []);

  const handleHolderChange = useCallback((text: string) => {
    // Exibição em maiúsculas (coerente com as fixtures "MARIA SILVA").
    setHolderName(text.toUpperCase());
  }, []);

  // Persiste o cartão: guarda contra duplo-submit e contra submit inválido;
  // confirma por toast e volta, ou erra por toast. `finally` destrava o save.
  const handleSubmit = useCallback(() => {
    if (saving || !isValid) return;
    setSaving(true);
    walletService
      .addCard({
        number, // dígitos crus — o mock re-normaliza e deriva last4/bandeira.
        holderName: holderName.trim(),
        expiry: formatExpiry(expiry),
        cvv,
      })
      .then(() => {
        showSuccess('Cartão adicionado');
        router.back();
      })
      .catch(() => {
        showError('Não foi possível adicionar o cartão.');
      })
      .finally(() => {
        // Guarda de montagem: o usuário pode ter voltado durante o save.
        if (mountedRef.current) setSaving(false);
      });
  }, [saving, isValid, number, holderName, expiry, cvv, walletService, showSuccess, showError, router]);

  const disabled = !isValid || saving;

  return (
    <View style={styles.container}>
      {/* Header: "Voltar" fantasma (afordância real de navegação — sub-tela). */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          testID="btn-back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backButton}
          onPress={handleBack}
        >
          <Icon name="chevron-left" size={24} color={colors.brand} />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.description}>
          Insira os dados do seu cartão para usá-lo para pagamentos de serviços.
        </Text>

        {/* Preview ao vivo do cartão (F0) — reflete nome, últimos 4 e bandeira. */}
        <CreditCard card={previewCard} testID="card-preview" />

        {/* Número do cartão — máscara "0000 0000 0000 0000". */}
        <CustomInput
          label="Número do cartão"
          placeholder="0000 0000 0000 0000"
          testID="input-number"
          value={formatCardNumber(number)}
          onChangeText={handleNumberChange}
          onBlur={() => markTouched('number')}
          keyboardType="numeric"
          maxLength={19} // 16 dígitos + 3 espaços
          error={touched.number ? errors.number : undefined}
        />

        {/* Validade + CVV lado a lado (espelha o Figma). */}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <CustomInput
              label="Validade"
              placeholder="MM/AA"
              testID="input-expiry"
              value={formatExpiry(expiry)}
              onChangeText={handleExpiryChange}
              onBlur={() => markTouched('expiry')}
              keyboardType="numeric"
              maxLength={5} // MM/AA
              error={touched.expiry ? errors.expiry : undefined}
            />
          </View>
          <View style={styles.rowItem}>
            <CustomInput
              label="CVV"
              placeholder="000"
              testID="input-cvv"
              value={cvv}
              onChangeText={handleCvvChange}
              onBlur={() => markTouched('cvv')}
              keyboardType="numeric"
              maxLength={4}
              error={touched.cvv ? errors.cvv : undefined}
            />
          </View>
        </View>

        {/* Nome no cartão — texto livre, exibição em maiúsculas. */}
        <CustomInput
          label="Nome no cartão"
          placeholder="Nome do titular"
          testID="input-holder"
          value={holderName}
          onChangeText={handleHolderChange}
          onBlur={() => markTouched('holderName')}
          autoCapitalize="characters"
          maxLength={26}
          error={touched.holderName ? errors.holderName : undefined}
        />

        {/* CTA "Salvar cartão" — navy, radius 24, texto branco bold. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar cartão"
          accessibilityState={{ disabled }}
          testID="btn-save-card"
          disabled={disabled}
          style={[styles.saveButton, disabled && styles.saveButtonDisabled]}
          onPress={handleSubmit}
        >
          <Text style={styles.saveButtonText}>Salvar cartão</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

export default NewCardScreen;

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
  // ── Corpo ────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    rowGap: 20,
  },
  description: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    columnGap: 12,
  },
  rowItem: {
    flex: 1,
  },
  // ── Salvar ───────────────────────────────────────────────
  saveButton: {
    height: 52,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
});
