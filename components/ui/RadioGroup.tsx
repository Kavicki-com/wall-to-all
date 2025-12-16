import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { RadioButton } from './RadioButton';

export interface RadioGroupOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface RadioGroupProps {
  options: RadioGroupOption[];
  value: string | number | null;
  onValueChange: (value: string | number) => void;
  direction?: 'row' | 'column';
  gap?: number;
  style?: ViewStyle;
  disabled?: boolean;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  options,
  value,
  onValueChange,
  direction = 'row',
  gap = 12,
  style,
  disabled = false,
}) => {
  const containerStyle: ViewStyle = {
    flexDirection: direction,
    gap,
    flexWrap: direction === 'row' ? 'wrap' : undefined,
  };

  return (
    <View style={[styles.radioGroup, containerStyle, style]}>
      {options.map((option) => (
        <RadioButton
          key={option.value}
          label={option.label}
          value={option.value}
          selected={value === option.value}
          onPress={() => !disabled && !option.disabled && onValueChange(option.value)}
          disabled={disabled || option.disabled}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  radioGroup: {
    width: '100%',
  },
});