import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Props = {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
};

export const InlineLink: React.FC<Props> = ({ label, onPress, style }) => {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.wrap, style]}>
      <View style={styles.row}>
        <Text style={styles.text}>{label}</Text>
        <MaterialIcons name="chevron-right" size={20} color="#9BB0FF" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#9BB0FF',
  },
});
