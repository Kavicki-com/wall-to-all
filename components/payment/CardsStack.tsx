import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { CreditCard } from './CreditCard';
import type { PaymentCard } from '../../lib/services/types';

export interface CardsStackProps {
  cards: PaymentCard[];
  /** Índice do cartão que fica à frente, totalmente visível. */
  activeIndex?: number;
  onSelect?: (card: PaymentCard, index: number) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Figma node 2663:6979 — pilha de cartões com o ativo à frente.
const STACK_HEIGHT = 268;
// Quanto cada cartão mais ao fundo sobe (peeking) em relação ao ativo.
const PEEK_OFFSET = 22;
// Redução de escala por nível de profundidade e piso para não sumir.
const SCALE_STEP = 0.05;
const MIN_SCALE = 0.85;
// Leve escurecimento/opacidade por profundidade (tinta sutil opcional do Figma).
const OPACITY_STEP = 0.08;
const MIN_OPACITY = 0.7;

/**
 * Rank de profundidade ÚNICO por cartão: ordena os índices por distância ao
 * ativo e, no empate (lados opostos de um activeIndex interior), pelo próprio
 * índice. Assim nenhum par de cartões colapsa no mesmo transform/zIndex. Com
 * activeIndex 0 o rank é o próprio índice (comportamento da F1 preservado).
 */
function depthRanks(count: number, activeIndex: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i).sort(
    (a, b) => Math.abs(a - activeIndex) - Math.abs(b - activeIndex) || a - b,
  );
  const ranks = new Array<number>(count);
  order.forEach((index, rank) => {
    ranks[index] = rank;
  });
  return ranks;
}

export const CardsStack: React.FC<CardsStackProps> = ({
  cards,
  activeIndex = 0,
  onSelect,
  style,
  testID,
}) => {
  const slotTestIdPrefix = testID ?? 'cards-stack';
  const ranks = depthRanks(cards.length, activeIndex);
  return (
    <View testID={testID} style={[styles.container, style]}>
      {cards.map((card, index) => {
        // Profundidade = rank do cartão; 0 = à frente.
        const depth = ranks[index];
        const translateY = -depth * PEEK_OFFSET;
        const scale = Math.max(MIN_SCALE, 1 - depth * SCALE_STEP);
        const opacity = Math.max(MIN_OPACITY, 1 - depth * OPACITY_STEP);
        // Ativo (depth 0) tem o maior zIndex → fica à frente.
        const zIndex = cards.length - depth;

        return (
          <Pressable
            key={card.id}
            testID={`${slotTestIdPrefix}-card-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`Cartão terminado em ${card.last4}`}
            onPress={() => onSelect?.(card, index)}
            style={[styles.cardSlot, { zIndex, opacity, transform: [{ translateY }, { scale }] }]}
          >
            <CreditCard card={card} />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: STACK_HEIGHT,
    width: '100%',
    justifyContent: 'flex-end',
  },
  cardSlot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
