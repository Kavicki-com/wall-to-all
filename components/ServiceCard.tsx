import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { IconRatingStar } from '../lib/icons';

interface ServiceCardProps {
  name: string;
  price: number;
  photos: string[] | string | null;
  rating?: number;
  reviewCount?: number;
  categoryName?: string | null;
  containerStyle?: ViewStyle;
  onPress?: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  name,
  price,
  photos,
  rating,
  reviewCount,
  categoryName: _categoryName,
  containerStyle,
  onPress,
}) => {
  // Processamento inteligente de photos
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
  const firstImage = imagesArray.length > 0 ? imagesArray[0] : null;

  // Formatação de preço: R$ X,XX
  const formattedPrice = `R$ ${price.toFixed(2).replace('.', ',')}`;

  // Container baseado em onPress
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.serviceCard, containerStyle]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : undefined}
    >
      <View style={styles.serviceImageContainer}>
        {firstImage ? (
          <Image
            source={{ uri: firstImage }}
            style={styles.serviceImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.serviceImage, styles.placeholderImage]} />
        )}
      </View>
      <View style={styles.serviceInfo}>
        <Text style={styles.serviceName}>{name}</Text>
        <View style={styles.serviceRating}>
          <Text style={styles.serviceRatingValue}>
            {typeof rating === 'number' ? rating.toFixed(1) : '4.5'}
          </Text>
          <IconRatingStar size={16} color="#FFD700" />
          <Text style={styles.serviceRatingCount}>
            ({typeof reviewCount === 'number' ? reviewCount : 25})
          </Text>
        </View>
        <Text style={styles.servicePrice}>{formattedPrice}</Text>
      </View>
    </Container>
  );
};

export default ServiceCard;

const styles = StyleSheet.create({
  serviceCard: {
    flexDirection: 'row',
    width: '100%',
    height: 104,
    borderWidth: 1,
    borderColor: '#0F0F0F',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    gap: 12,
    alignItems: 'stretch',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  serviceImageContainer: {
    width: 110,
    height: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  serviceImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  serviceInfo: {
    flex: 1,
    height: '100%',
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 0,
    gap: 6,
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: 15,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  serviceRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceRatingValue: {
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  serviceRatingCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#6A6A6A',
  },
  servicePrice: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
    marginTop: 2,
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
});

