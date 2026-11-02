import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import type { PaymentCard } from '../../lib/services/types';
import { colors } from '../../lib/theme';
import { CardsStack } from './CardsStack';

export interface CardSelectionBottomSheetProps {
  visible: boolean;
  cards: PaymentCard[];
  /** Cartão que abre à frente da pilha. */
  selectedCardId: string | null;
  /** Confirma o cartão à frente ("Selecionar cartão"). */
  onSelect: (card: PaymentCard) => void;
  /** Fecha o sheet (backdrop/voltar). */
  onClose: () => void;
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

// Figma node 2668:18327: sheet "Meus cartões" com a pilha de cartões salvos e o
// selecionado à frente; tocar num cartão o traz à frente e o CTA confirma.
export const CardSelectionBottomSheet: React.FC<CardSelectionBottomSheetProps> = ({
  visible,
  cards,
  selectedCardId,
  onSelect,
  onClose,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // Ao abrir, sincroniza o cartão da frente com a seleção atual da tela.
  useEffect(() => {
    if (!visible) return;
    const index = cards.findIndex((card) => card.id === selectedCardId);
    setActiveIndex(index >= 0 ? index : 0);
  }, [visible, cards, selectedCardId]);

  if (!visible) return null;

  const activeCard = cards[activeIndex] ?? null;
  const disabled = activeCard === null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          testID="card-selection-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            Meus cartões
          </Text>

          {cards.length > 0 ? (
            <CardsStack
              cards={cards}
              activeIndex={activeIndex}
              onSelect={(_, index) => setActiveIndex(index)}
            />
          ) : (
            <Text style={styles.empty}>Nenhum cartão salvo</Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Selecionar cartão"
            accessibilityState={{ disabled }}
            hitSlop={HIT_SLOP}
            disabled={disabled}
            style={[styles.cta, disabled && styles.ctaDisabled]}
            onPress={() => activeCard && onSelect(activeCard)}
          >
            <Text style={[styles.ctaText, disabled && styles.ctaTextDisabled]}>
              Selecionar cartão
            </Text>
          </Pressable>
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
    paddingBottom: 32,
    rowGap: 16,
    alignItems: 'center',
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
  empty: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 40,
  },
  cta: {
    alignSelf: 'stretch',
    height: 44,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    borderColor: colors.disabled,
  },
  ctaText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: colors.brand,
  },
  ctaTextDisabled: {
    color: colors.disabled,
  },
});
