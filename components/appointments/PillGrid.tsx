import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { PillOption } from './PillOption';

export type PillItem = {
  key: string;
  label: string;
  disabled?: boolean;
  showLunchIcon?: boolean;
};

type Props = {
  items: PillItem[];
  selectedKey?: string | null;
  onSelect: (key: string) => void;
  style?: ViewStyle;
};

export const PillGrid: React.FC<Props> = ({ items, selectedKey, onSelect, style }) => {
  return (
    <View style={[styles.grid, style]}>
      {items.map((item) => (
        <View key={item.key} style={styles.cell}>
          <PillOption
            label={item.label}
            selected={selectedKey === item.key}
            disabled={item.disabled}
            showLunchIcon={item.showLunchIcon}
            onPress={() => onSelect(item.key)}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  cell: {
    width: '48%',
  },
});
