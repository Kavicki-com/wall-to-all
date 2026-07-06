import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';

type Props = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  showLunchIcon?: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

export const PillOption: React.FC<Props> = ({ label, selected, disabled, showLunchIcon, onPress, style }) => {
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
      <View style={styles.content}>
        {showLunchIcon && (
          <Icon name="restaurant" family="MaterialSymbols" size={18} color={selected ? colors.surface : colors.textPrimary} />
        )}
        <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
          {label}
        </Text>
      </View>
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
    backgroundColor: colors.brand,
  },
  disabled: {
    opacity: 0.55,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    lineHeight: 20,
  },
  labelUnselected: {
    color: colors.brand,
  },
  labelSelected: {
    color: colors.surface,
  },
});
