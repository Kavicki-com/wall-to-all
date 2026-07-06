import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SurfaceCard from '../ui/SurfaceCard';
import { IconRatingStar, IconKidStar } from '../../lib/icons';
import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';

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
  /**
   * Callback when user taps "Ver mais" link. Only shown when totalReviews > 0.
   */
  onViewReviews?: () => void;
}

/**
 * Displays a summary of rating and price information in a two column
 * layout. It uses `SurfaceCard` for the background and margins.
 */
const RatingsRowCard: React.FC<RatingsRowCardProps> = ({ averageRating, totalReviews, priceRange, onViewReviews }) => {
  const ratingText = totalReviews === 0 ? 'Sem avaliações' : averageRating.toFixed(1);
  const priceActive = priceRange.slice(0, 3);
  const priceInactive = priceRange.slice(3);

  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.row}>
        <View style={styles.ratingSection}>
          {totalReviews > 0 ? (
            <>
              <Text style={styles.ratingText}>{ratingText}</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((starValue) => (
                  starValue <= Math.round(averageRating) ? (
                    <IconRatingStar key={starValue} size={12} color="#FFD700" />
                  ) : (
                    <IconKidStar key={starValue} size={12} color="#DBDBDB" />
                  )
                ))}
              </View>
              <Text style={styles.ratingCount}>({totalReviews})</Text>
              {onViewReviews && (
                <TouchableOpacity 
                  style={styles.viewMoreLink}
                  onPress={onViewReviews}
                  activeOpacity={0.7}
                >
                  <Icon name="keyboard-arrow-right" size={18} color={colors.brand} />
                  <Text style={styles.viewMoreText}>Ver mais</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={styles.ratingText}>{ratingText}</Text>
          )}
        </View>
        <View style={styles.priceSection}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel} numberOfLines={1}>
              Preço médio
            </Text>
            <Text style={styles.priceValue} numberOfLines={1}>
              {priceActive}
              <Text style={styles.priceInactive}>{priceInactive}</Text>
            </Text>
          </View>
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
    flex: 1,
    gap: 4,
    marginRight: 12,
    minWidth: 0,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
  },
  ratingText: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Montserrat_500Medium',
    color: colors.textPrimary,
  },
  ratingCount: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Montserrat_500Medium',
    color: colors.textSecondary,
  },
  priceSection: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 4,
  },
  priceLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Montserrat_500Medium',
    color: colors.textPrimary,
  },
  priceValue: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
    flexShrink: 0,
  },
  priceInactive: {
    color: '#DBDBDB',
  },
  viewMoreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 2,
  },
  viewMoreText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: colors.brand,
  },
});

export default RatingsRowCard;
