import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardField, confirmSetupIntent } from '@stripe/stripe-react-native';
import type { CardFieldInput } from '@stripe/stripe-react-native';
import { useWalletService } from '../../../context/ServicesContext';
import { Icon } from '../../../components/ui/Icon';
import { CustomInput } from '../../../components/ui/CustomInput';
import { CreditCard } from '../../../components/payment/CreditCard';
import { useToast } from '../../../components/ui/ToastProvider';
import type { CardBrand, PaymentCard } from '../../../lib/services/types';
import { colors } from '../../../lib/theme';

const GENERIC_ERROR = 'Não foi possível adicionar o cartão.';
const DECLINED_ERROR = 'Cartão recusado. Tente outro cartão.';

/**
 * Bandeira do `onCardChange` para o preview. O SDK manda string ("Visa",
 * "MasterCard", "AmericanExpress") no evento nativo, mas o tipo declara um enum
 * numérico: aceita os dois. O resto vira Elo, como no preview da F3.
 */
function previewBrand(brand: unknown): CardBrand {
  const key = String(brand ?? '').toLowerCase();
  if (key === 'visa' || key === '7') return 'visa';
  if (key === 'mastercard' || key === '5') return 'mastercard';
  if (key === 'amex' || key === 'americanexpress' || key === '1') return 'amex';
  return 'elo';
}

/** Validade "MM/AA" do onCardChange (vazio enquanto não digitada). */
function previewExpiry(card: CardFieldInput.Details | null): string {
  if (!card || !card.expiryMonth || !card.expiryYear) return '';
  const mm = String(card.expiryMonth).padStart(2, '0');
  const yy = String(card.expiryYear % 100).padStart(2, '0');
  return `${mm}/${yy}`;
}

/** id do SetupIntent a partir do client secret (`seti_x_secret_y` vira `seti_x`). */
function setupIntentIdFromSecret(secret: string): string {
  return secret.split('_secret_')[0];
}

/** Erro do SDK: "Cartão recusado" para card_declined, genérico nos demais. */
function sdkErrorMessage(error: { stripeErrorCode?: string }): string {
  return error.stripeErrorCode === 'card_declined' ? DECLINED_ERROR : GENERIC_ERROR;
}

/** Erro de serviço: copy pt-BR do PaymentsApiError; o resto vira genérico. */
function serviceErrorMessage(err: unknown): string {
  return err instanceof Error && err.name === 'PaymentsApiError' ? err.message : GENERIC_ERROR;
}

/**
 * Cadastro de novo cartão do cliente (Figma node 2660:6604), F8 Task 14.
 *
 * Os dados do cartão entram pelo `CardField` da Stripe: número, validade e CVV
 * nunca passam pelo app nem pelo `WalletService` (PCI). Divergência do Figma:
 * os três campos separados (número, validade, CVV) viraram um único campo
 * nativo da Stripe, estilizado com os tokens do `CustomInput`. O nome continua
 * num `CustomInput` próprio e vai como `billingDetails.name`.
 *
 * Fluxo: `beginCardSetup` (SetupIntent no servidor), `confirmSetupIntent` no
 * SDK, `completeCardSetup` (anexa e devolve o cartão). No mock
 * (`cardSetupConfirmsWithStripe` false) não há SDK: completa direto.
 *
 * O preview `CreditCard` usa só o que o `onCardChange` expõe (final, bandeira,
 * validade). Guarda de duplo toque por ref (o state só muda no próximo render)
 * e guarda de montagem para o setState depois do await.
 */
const NewCardScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const walletService = useWalletService();
  const { showSuccess, showError } = useToast();

  const [holderName, setHolderName] = useState('');
  const [holderTouched, setHolderTouched] = useState(false);
  const [card, setCard] = useState<CardFieldInput.Details | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const name = holderName.trim();
  const holderError = name.length > 0 ? undefined : 'Informe o nome no cartão';
  const isValid = !holderError && card?.complete === true;

  const previewCard: PaymentCard = useMemo(
    () => ({
      id: 'preview',
      brand: previewBrand(card?.brand),
      last4: card?.last4 || '0000',
      holderName: holderName || 'NOME DO TITULAR',
      expiry: previewExpiry(card),
      isDefault: false,
    }),
    [card, holderName],
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleHolderChange = useCallback((text: string) => {
    // Exibição em maiúsculas (coerente com as fixtures "MARIA SILVA").
    setHolderName(text.toUpperCase());
  }, []);

  const handleCardChange = useCallback((details: CardFieldInput.Details) => {
    setCard(details);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (savingRef.current || !isValid) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const { setupIntentClientSecret } = await walletService.beginCardSetup();
      let setupIntentId = setupIntentIdFromSecret(setupIntentClientSecret);

      if (walletService.cardSetupConfirmsWithStripe) {
        const { setupIntent, error } = await confirmSetupIntent(setupIntentClientSecret, {
          paymentMethodType: 'Card',
          paymentMethodData: { billingDetails: { name } },
        });
        if (error) {
          // Cancelado pelo usuário (ex.: desafio 3DS fechado): sem toast.
          if (String(error.code) !== 'Canceled') showError(sdkErrorMessage(error));
          return;
        }
        setupIntentId = setupIntent.id;
      }

      await walletService.completeCardSetup(setupIntentId);
      showSuccess('Cartão adicionado');
      router.back();
    } catch (err) {
      showError(serviceErrorMessage(err));
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [isValid, name, walletService, showSuccess, showError, router]);

  const disabled = !isValid || saving;

  return (
    <View style={styles.container}>
      {/* Header: "Voltar" fantasma (afordância real de navegação, sub-tela). */}
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

        {/* Preview (F0): final, bandeira e validade do onCardChange, mais o nome. */}
        <CreditCard card={previewCard} testID="card-preview" />

        {/* Número, validade e CVV: campo nativo da Stripe (os dados não passam pelo app). */}
        <View>
          <Text style={styles.fieldLabel}>Dados do cartão</Text>
          <CardField
            testID="card-field"
            postalCodeEnabled={false}
            placeholders={{ number: '0000 0000 0000 0000', expiration: 'MM/AA', cvc: 'CVV' }}
            cardStyle={CARD_STYLE}
            style={styles.cardField}
            onCardChange={handleCardChange}
          />
        </View>

        <CustomInput
          label="Nome no cartão"
          placeholder="Nome do titular"
          testID="input-holder"
          value={holderName}
          onChangeText={handleHolderChange}
          onBlur={() => setHolderTouched(true)}
          autoCapitalize="characters"
          maxLength={26}
          error={holderTouched ? holderError : undefined}
        />

        {/* CTA "Salvar cartão": navy, radius 24, texto branco bold. */}
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

/** Tokens do CustomInput (Figma: borda cinza 1px, radius 4, Montserrat 16). */
const CARD_STYLE: CardFieldInput.Styles = {
  backgroundColor: colors.surface,
  borderColor: colors.textSecondary,
  borderWidth: 1,
  borderRadius: 4,
  textColor: colors.textPrimary,
  placeholderColor: colors.textSecondary,
  textErrorColor: colors.accent,
  cursorColor: colors.brand,
  fontSize: 16,
  fontFamily: 'Montserrat_400Regular',
};

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
  fieldLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: colors.brand,
    marginBottom: 4,
  },
  cardField: {
    width: '100%',
    height: 56,
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
