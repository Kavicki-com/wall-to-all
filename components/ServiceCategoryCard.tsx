import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { IconRatingStar } from '../lib/icons';
import { useCardWidth, responsiveHeight, responsiveWidth, responsiveFontSize } from '../lib/responsive';
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
  testID?: string;
};

const ServiceCategoryCard: React.FC<Props> = React.memo(({
  id,
  name,
  price,
  photos,
  rating,
  reviewCount,
  category,
  onPress,
  testID,
}) => {
  const serviceCardWidth = useCardWidth(2, 24, 14);

  const imagesArray = React.useMemo(() => {
    let imgs: string[] = [];
    if (photos) {
      if (typeof photos === 'string') {
        try {
          imgs = JSON.parse(photos);
        } catch {
          imgs = [photos];
        }
      } else if (Array.isArray(photos)) {
        imgs = photos;
      }
    }
    return imgs;
  }, [photos]);

  const firstImage = imagesArray[0] || null;

  return (
    <TouchableOpacity

      style={[styles.card, { width: serviceCardWidth }]}
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
          {typeof rating === 'number' && typeof reviewCount === 'number' && reviewCount > 0 ? (
            <>
              <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>

              {[1, 2, 3, 4, 5].map((n) => (
                <IconRatingStar key={n} size={12} color="#FFD700" />
              ))}

              <Text style={styles.ratingCount}>({reviewCount})</Text>
            </>
          ) : (
            <Text style={styles.ratingCount}>Novo</Text>
          )}
        </View>

        <Text style={styles.price}>R$ {price.toFixed(2).replace('.', ',')}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default ServiceCategoryCard;

const styles = StyleSheet.create({
  card: {
    marginRight: responsiveWidth(14),
    backgroundColor: colors.background,
    borderRadius: responsiveWidth(8),
    overflow: 'hidden',
  },

  imageContainer: {
    height: responsiveHeight(94),
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
    borderRadius: responsiveWidth(8),
    paddingHorizontal: responsiveWidth(6),
    paddingVertical: responsiveHeight(4),
  },

  categoryText: {
    fontSize: responsiveFontSize(12),
    fontFamily: 'Montserrat_500Medium',
    color: colors.brand,
  },

  info: {
    padding: responsiveWidth(8),
    gap: responsiveHeight(7),
  },

  name: {
    fontSize: responsiveFontSize(16),
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
    minHeight: responsiveHeight(40),
    textAlign: 'left',
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

