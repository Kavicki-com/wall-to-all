import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'secondary',
  style,
  padding,
  paddingHorizontal,
  paddingVertical,
}) => {
  const cardStyle = variant === 'primary' ? styles.cardPrimary : styles.cardSecondary;
  
  const paddingStyle: ViewStyle = {};
  if (padding !== undefined) {
    paddingStyle.padding = padding;
  }
  if (paddingHorizontal !== undefined) {
    paddingStyle.paddingHorizontal = paddingHorizontal;
  }
  if (paddingVertical !== undefined) {
    paddingStyle.paddingVertical = paddingVertical;
  }

  return (
    <View style={[cardStyle, paddingStyle, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  cardPrimary: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  cardSecondary: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
});