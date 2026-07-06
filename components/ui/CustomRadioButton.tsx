import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../../lib/theme';

export interface CustomRadioButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  value?: string | number;
}

export const CustomRadioButton: React.FC<CustomRadioButtonProps> = ({
  label,
  selected,
  onPress,
  disabled = false,
  leftIcon,
  style,
  textStyle,
  value: _value,
}) => {
  return (
    <TouchableOpacity
      style={[styles.radioOption, style]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <View style={[styles.radioIconOuter, disabled && styles.radioIconOuterDisabled]}>
        {selected && <View style={[styles.radioIconInner, disabled && styles.radioIconInnerDisabled]} />}
      </View>
      {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
      <Text style={[styles.radioText, textStyle, disabled && styles.radioTextDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioIconOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioIconOuterDisabled: {
    borderColor: '#A0A0A0',
    opacity: 0.5,
  },
  radioIconInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  radioIconInnerDisabled: {
    backgroundColor: '#A0A0A0',
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: colors.textPrimary,
  },
  radioTextDisabled: {
    color: '#A0A0A0',
    opacity: 0.7,
  },
});