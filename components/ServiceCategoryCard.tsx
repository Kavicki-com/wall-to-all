import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { IconRatingStar } from '../lib/icons';
import { useCardWidth } from '../lib/responsive';

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

const ServiceCategoryCard: React.FC<Props> = ({
  id,
  name,
  price,
  photos,
  rating,
  reviewCount,
  category,
  onPress,
}) => {
  const serviceCardWidth = useCardWidth(2, 24, 14);

  let imagesArray: string[] = [];
  if (photos) {
    if (typeof photos === 'string') {
      try {
        imagesArray = JSON.parse(photos);
      } catch {
        imagesArray = [photos];
      }
    } else if (Array.isArray(photos)) {
      imagesArray = photos;
    }
  }
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
          <Text style={styles.ratingValue}>{rating?.toFixed(1) || '4.9'}</Text>

          {[1, 2, 3, 4, 5].map((n) => (
            <IconRatingStar key={n} size={12} color="#FFD700" />
          ))}

          <Text style={styles.ratingCount}>({reviewCount || 30})</Text>
        </View>

        <Text style={styles.price}>R$ {price.toFixed(2).replace('.', ',')}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default ServiceCategoryCard;

const styles = StyleSheet.create({
  card: {
    marginRight: 14,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    overflow: 'hidden',
  },

  imageContainer: {
    height: 94,
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
    top: 8,
    right: 8,
    backgroundColor: '#FEFEFE',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  categoryText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#000E3D',
  },

  info: {
    padding: 8,
    gap: 7,
  },

  name: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    minHeight: 40,
    textAlign: 'left',
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  ratingValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },

  ratingCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
  },

  price: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
});

