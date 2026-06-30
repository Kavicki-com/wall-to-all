import React from 'react';
import { Text, StyleSheet } from 'react-native';
import SurfaceCard from '../ui/SurfaceCard';
import { colors } from '../../lib/theme';

interface OperatingHoursCardProps {
  /**
   * Formatted string representing the business working hours, e.g.
   * "Seg–Sex 8:00–18:00".
   */
  hours: string;
}

/**
 * Card that displays the business operating hours. It follows the
 * design of the shared profile view by using bold labels and a
 * consistent surface.
 */
const OperatingHoursCard: React.FC<OperatingHoursCardProps> = ({ hours }) => {
  return (
    <SurfaceCard style={styles.card}>
      <Text style={styles.title}>Horário de funcionamento</Text>
      <Text style={styles.text}>{hours}</Text>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    // Use a small margin bottom to match the spacing between cards (8px).
    marginBottom: 8,
    paddingHorizontal: 16,
    // Increase vertical padding for consistent spacing relative to the content and other cards.
    paddingVertical: 16,
    gap: 8,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },
  text: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: colors.textPrimary,
  },
});

export default OperatingHoursCard;