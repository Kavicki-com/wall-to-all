import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useWalletService } from '../../context/ServicesContext';
import type { PaymentCard } from '../../lib/services/types';
import { colors } from '../../lib/theme';
import { formatBRL } from '../../lib/formatters';
import { CreditCard } from './CreditCard';
import { PaymentCardRow } from './PaymentCardRow';

export interface PaymentCardBottomSheetProps {
  visible: boolean;
  amountCents: number;
  description: string;
  /** Chamado quando o pagamento é aprovado (o pai fecha o sheet + segue o fluxo). */
  onSuccess: () => void;
  /** Fecha o sheet (backdrop/arrasto). */
  onClose: () => void;
}

// Figma node 2643:20390 — bottom-sheet "Pagamento com cartão". DIVERGÊNCIA
// deliberada do Figma (que desenha um FORMULÁRIO de novo cartão): o mock
// (`payWithCard(cardId, ...)`) só processa cartões SALVOS, então este sheet
// lista os cartões da carteira (`getCards` + PaymentCardRow da Task 12) e paga o
// selecionado. O formulário de novo cartão volta quando houver tokenização (F3+).
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export const PaymentCardBottomSheet: React.FC<PaymentCardBottomSheetProps> = ({
  visible,
  amountCents,
  description,
  onSuccess,
  onClose,
}) => {
  const wallet = useWalletService();
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [declined, setDeclined] = useState(false);

  // Ao abrir, carrega os cartões salvos e pré-seleciona o default (isDefault) —
  // ou o primeiro. Só busca quando visível.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setDeclined(false);
    setPaying(false);
    wallet
      .getCards()
      .then((list) => {
        if (!active) return;
        setCards(list);
        setSelectedId(
          (prev) => prev ?? (list.find((card) => card.isDefault) ?? list[0])?.id ?? null,
        );
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, wallet]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedId) ?? null,
    [cards, selectedId],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setDeclined(false); // Trocar de cartão após uma recusa limpa a mensagem.
  }, []);

  const handlePay = useCallback(async () => {
    if (paying || !selectedId) return;
    setPaying(true);
    setDeclined(false);
    try {
      const result = await wallet.payWithCard(selectedId, amountCents, description);
      if (result.status === 'approved') {
        onSuccess(); // Pai fecha o sheet; não reabilita o CTA aqui.
        return;
      }
      // Recusado: mostra o estado e reabilita o CTA para tentar outro cartão.
      setDeclined(true);
      setPaying(false);
    } catch {
      setPaying(false);
    }
  }, [paying, selectedId, wallet, amountCents, description, onSuccess]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          testID="card-sheet-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            Pagamento com cartão
          </Text>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.subtitle}>Realize o pagamento para concluir seu pedido</Text>

            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : (
              <>
                {selectedCard ? <CreditCard card={selectedCard} /> : null}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{formatBRL(amountCents)}</Text>
                </View>

                <Text style={styles.sectionLabel}>Cartões salvos</Text>
                <View style={styles.cardList}>
                  {cards.map((card) => (
                    <PaymentCardRow
                      key={card.id}
                      card={card}
                      selected={card.id === selectedId}
                      onPress={() => handleSelect(card.id)}
                    />
                  ))}
                </View>

                {declined ? (
                  <Text style={styles.decline}>Pagamento recusado. Tente outro cartão.</Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: paying || !selectedId }}
                  hitSlop={HIT_SLOP}
                  style={[styles.payButton, (paying || !selectedId) && styles.payButtonDisabled]}
                  disabled={paying || !selectedId}
                  onPress={handlePay}
                >
                  <Text style={styles.payButtonText}>Concluir Pagamento</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    rowGap: 16,
    alignItems: 'center',
    maxHeight: '90%',
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceGrey,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.accent,
    textAlign: 'center',
  },
  content: {
    rowGap: 16,
    paddingBottom: 8,
  },
  subtitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  totalValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  sectionLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: colors.brand,
  },
  cardList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceGrey,
    paddingHorizontal: 12,
  },
  decline: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: colors.accent,
    textAlign: 'center',
  },
  payButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  payButtonText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.contentLight,
  },
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
});
