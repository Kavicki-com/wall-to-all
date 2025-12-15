import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';

type Props = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

export const PillOption: React.FC<Props> = ({ label, selected, disabled, onPress, style }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        selected ? styles.selected : styles.unselected,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  unselected: {
    backgroundColor: '#E9EEFF',
  },
  selected: {
    backgroundColor: '#000E3D',
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
  },
  labelUnselected: {
    color: '#000E3D',
  },
  labelSelected: {
    color: '#FEFEFE',
  },
});
