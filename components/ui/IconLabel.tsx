import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface IconLabelProps {
  /**
   * Icon element to display on the left. It should be a valid
   * React element (e.g. an imported SVG component).
   */
  icon: React.ReactNode;
  /**
   * Text displayed next to the icon.
   */
  label: string;
}

/**
 * Displays a small icon followed by a label, useful for lists of
 * payment methods or features. Keeps a consistent gap and font size.
 */
const IconLabel: React.FC<IconLabelProps> = ({ icon, label }) => {
  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
});

export default IconLabel;