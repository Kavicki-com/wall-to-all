import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface SurfaceCardProps {
  /**
   * Content of the card.
   */
  children: React.ReactNode;
  /**
   * Optional style override.
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * A simple wrapper component that provides a white background, rounded
 * corners and a subtle shadow. Use this instead of manually styling
 * `View` elements when you need a card-like surface. It accepts an
 * optional `style` prop for additional customization.
 */
const SurfaceCard: React.FC<SurfaceCardProps> = ({ children, style }) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    padding: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default SurfaceCard;