import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { IconRatingStar } from '../lib/icons';
import { responsiveHeight, responsiveWidth, responsiveFontSize } from '../lib/responsive';
import { colors } from '../lib/theme';

type Props = {
  id: number;
  name: string;
  price: number;
  photos: string[] | string | null;
  rating?: number;
  reviewCount?: number;
  category?: string | null;
  onPress?: (id: number) => void;
};

const TopServiceCard: React.FC<Props> = React.memo(({
  id,
  name,
  price,
  photos,
  rating,
  reviewCount,
  category,
  onPress,
}) => {
  const imagesArray = React.useMemo(() => {
    if (photos) {
      if (typeof photos === 'string') {
        try {
          const parsed = JSON.parse(photos);
          return Array.isArray(parsed) ? parsed : [photos];
        } catch {
          return [photos];
        }
      } else if (Array.isArray(photos)) {
        return photos;
      }
    }
    return [];
  }, [photos]);

  const firstImage = imagesArray[0] || null;
  const ratingValue = rating?.toFixed(1) || '4.9';
  const ratingCountText = `(${reviewCount || 30})`;
  const priceText = `R$ ${price.toFixed(2).replace('.', ',')}`;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => onPress?.(id)}
    >
      <View style={styles.imageContainer}>
        {firstImage ? (
          <Image source={{ uri: firstImage }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.placeholderImage]} />
        )}

        {category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{category}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>

        <View style={styles.ratingRow}>
          <Text style={styles.ratingValue}>{ratingValue}</Text>

          {[1, 2, 3, 4, 5].map((n) => (
            <IconRatingStar key={n} size={12} color="#FFD700" />
          ))}

          <Text style={styles.ratingCount}>{ratingCountText}</Text>
        </View>

        <Text style={styles.price}>{priceText}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default TopServiceCard;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 0,
    backgroundColor: colors.background,
    borderRadius: responsiveWidth(12),
    overflow: 'hidden',
  },

  imageContainer: {
    height: responsiveHeight(140),
    position: 'relative',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },

  categoryBadge: {
    position: 'absolute',
    top: responsiveHeight(8),
    right: responsiveWidth(8),
    backgroundColor: colors.surface,
    borderRadius: responsiveWidth(12),
    paddingHorizontal: responsiveWidth(10),
    paddingVertical: responsiveHeight(4),
  },

  categoryText: {
    fontSize: responsiveFontSize(12),
    fontFamily: 'Montserrat_500Medium',
    color: colors.brand,
  },

  info: {
    paddingHorizontal: responsiveWidth(12),
    paddingVertical: responsiveHeight(10),
    gap: responsiveHeight(6),
  },

  name: {
    fontSize: responsiveFontSize(16),
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveWidth(4),
  },

  ratingValue: {
    fontSize: responsiveFontSize(12),
    fontFamily: 'Montserrat_500Medium',
    color: colors.textPrimary,
  },

  ratingCount: {
    fontSize: responsiveFontSize(12),
    fontFamily: 'Montserrat_500Medium',
    color: colors.textSecondary,
  },

  price: {
    fontSize: responsiveFontSize(16),
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
});

