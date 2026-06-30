import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../lib/theme';

interface ScheduleSectionHeaderProps {
  icon: ReactNode;
  title: string;
  style?: ViewStyle;
}

export const ScheduleSectionHeader: React.FC<ScheduleSectionHeaderProps> = ({
  icon,
  title,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
  },
});
