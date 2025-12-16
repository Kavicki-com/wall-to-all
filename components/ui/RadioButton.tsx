import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export interface RadioButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  value?: string | number;
}

export const RadioButton: React.FC<RadioButtonProps> = ({
  label,
  selected,
  onPress,
  disabled = false,
  style,
  textStyle,
  value: _value,
}) => {
  return (
    <TouchableOpacity
      style={[styles.radioOption, style]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[styles.radioIconOuter, disabled && styles.radioIconOuterDisabled]}>
        {selected && <View style={[styles.radioIconInner, disabled && styles.radioIconInnerDisabled]} />}
      </View>
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
    borderColor: '#000E3D',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioIconOuterDisabled: {
    borderColor: '#A0A0A0',
    opacity: 0.5,
  },
  radioIconInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000E3D',
  },
  radioIconInnerDisabled: {
    backgroundColor: '#A0A0A0',
  },
  radioText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
  },
  radioTextDisabled: {
    color: '#A0A0A0',
    opacity: 0.7,
  },
});