import React, { ReactNode } from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../lib/theme';

interface PrimaryActionButtonProps {
  title: string;
  rightIcon: ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  onPress: () => void;
}

export const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({
  title,
  rightIcon,
  disabled = false,
  isLoading = false,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, (disabled || isLoading) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || isLoading }}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.surface} />
      ) : (
        <>
          <Text style={styles.text}>{title}</Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.surface,
  },
});
