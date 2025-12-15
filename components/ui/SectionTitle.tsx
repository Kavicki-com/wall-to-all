import React from 'react';
import { Text, StyleSheet, StyleProp, TextStyle } from 'react-native';

interface SectionTitleProps {
  /**
   * Text to display as the section heading.
   */
  children: React.ReactNode;
  /**
   * Optional style override for the title text.
   */
  style?: StyleProp<TextStyle>;
}

/**
 * Consistent heading used to separate different sections of content.
 * It applies the accent colour from the design system and bold font.
 */
const SectionTitle: React.FC<SectionTitleProps> = ({ children, style }) => {
  return <Text style={[styles.title, style]}>{children}</Text>;
};

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
});

export default SectionTitle;