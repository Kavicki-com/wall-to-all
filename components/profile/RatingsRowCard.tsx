import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SurfaceCard from '../ui/SurfaceCard';

interface RatingsRowCardProps {
  /**
   * Average rating for the business (0–5). Will be ignored when
   * totalReviews is zero.
   */
  averageRating: number;
  /**
   * Number of reviews. When zero, "Sem avaliações" is shown.
   */
  totalReviews: number;
  /**
   * String representing price range, such as "$$$--". The first
   * part will be coloured red and the trailing dashes grey.
   */
  priceRange: string;
}

/**
 * Displays a summary of rating and price information in a two column
 * layout. It uses `SurfaceCard` for the background and margins.
 */
const RatingsRowCard: React.FC<RatingsRowCardProps> = ({ averageRating, totalReviews, priceRange }) => {
  const ratingText = totalReviews === 0 ? 'Sem avaliações' : averageRating.toFixed(1);
  const priceActive = priceRange.slice(0, 3);
  const priceInactive = priceRange.slice(3);

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.row}>
        <View style={styles.ratingSection}>
          <Text style={styles.ratingText}>{ratingText}</Text>
          <Text style={styles.ratingCount}>({totalReviews})</Text>
        </View>
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Preço médio</Text>
          <Text style={styles.priceValue}>
            {priceActive}
            <Text style={styles.priceInactive}>{priceInactive}</Text>
          </Text>
        </View>
      </View>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    // Horizontal margin to align with other cards on the page
    marginHorizontal: 24,
    // Spacing from the bottom of the banner to the top of this card should be 16px
    marginTop: 16,
    // Provide consistent spacing below the card before the next section.
    marginBottom: 8,
    // Padding to align the content within the card
    paddingHorizontal: 16,
    paddingVertical: 10,
    // Apply uniform border radius to all corners so the card has its own shape.
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  ratingCount: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
  },
  priceSection: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  priceValue: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  priceInactive: {
    color: '#DBDBDB',
  },
});

export default RatingsRowCard;