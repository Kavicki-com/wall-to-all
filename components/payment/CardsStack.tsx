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

export const CardsStack: React.FC<CardsStackProps> = ({
  cards,
  activeIndex = 0,
  onSelect,
  style,
  testID,
}) => {
  return (
    <View testID={testID} style={[styles.container, style]}>
      {cards.map((card, index) => {
        // Profundidade = distância ao cartão ativo; 0 = à frente.
        const depth = Math.abs(index - activeIndex);
        const translateY = -depth * PEEK_OFFSET;
        const scale = Math.max(MIN_SCALE, 1 - depth * SCALE_STEP);
        const opacity = Math.max(MIN_OPACITY, 1 - depth * OPACITY_STEP);
        // Ativo (depth 0) tem o maior zIndex → fica à frente.
        const zIndex = cards.length - depth;

        return (
          <Pressable
            key={card.id}
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
