import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { IconRatingStar } from '../lib/icons';

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

const TopServiceCard: React.FC<Props> = ({
  id,
  name,
  price,
  photos,
  rating,
  reviewCount,
  category,
  onPress,
}) => {
  let imagesArray: string[] = [];

  if (photos) {
    if (typeof photos === 'string') {
      try {
        const parsed = JSON.parse(photos);
        imagesArray = Array.isArray(parsed) ? parsed : [photos];
      } catch {
        imagesArray = [photos];
      }
    } else if (Array.isArray(photos)) {
      imagesArray = photos;
    }
  }

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
};

export default TopServiceCard;

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 0,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    overflow: 'hidden',
  },

  imageContainer: {
    height: 140,
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
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  categoryText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#000E3D',
  },

  info: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },

  name: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
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

