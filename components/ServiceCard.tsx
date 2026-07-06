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
import { useResponsiveWidth, responsiveHeight, responsiveFontSize } from '../lib/responsive';
import { colors } from '../lib/theme';

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

const ServiceCard: React.FC<ServiceCardProps> = React.memo(({
  name,
  price,
  photos,
  rating,
  reviewCount,
  categoryName: _categoryName,
  containerStyle,
  onPress,
}) => {
  // Dimensões responsivas
  const cardHeight = responsiveHeight(104);
  const imageWidth = useResponsiveWidth(110);

  // Processamento inteligente de photos
  const imagesArray = React.useMemo(() => {
    let result: string[] = [];
    if (photos) {
      /**
       * Se vier string, tenta parsear. Se falhar, assume que a própria string é a URL.
       * Exceção: se for um array JSON válido.
       */
      if (typeof photos === 'string') {
        try {
          result = JSON.parse(photos);
        } catch {
          result = [photos];
        }
      } else if (Array.isArray(photos)) {
        result = photos;
      }
    }
    return result;
  }, [photos]);
  const firstImage = imagesArray.length > 0 ? imagesArray[0] : null;

  // Formatação de preço: R$ X,XX
  const formattedPrice = `R$ ${price.toFixed(2).replace('.', ',')}`;

  // Container baseado em onPress
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.serviceCard, { height: cardHeight }, containerStyle]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : undefined}

    >
      <View style={[styles.serviceImageContainer, { width: imageWidth }]}>
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
          {typeof rating === 'number' && typeof reviewCount === 'number' && reviewCount > 0 ? (
            <>
              <Text style={styles.serviceRatingValue}>{rating.toFixed(1)}</Text>
              <IconRatingStar size={16} color="#FFD700" />
              <Text style={styles.serviceRatingCount}>({reviewCount})</Text>
            </>
          ) : (
            <Text style={styles.serviceRatingCount}>Novo</Text>
          )}
        </View>
        <Text style={styles.servicePrice}>{formattedPrice}</Text>
      </View>
    </Container>
  );
});

export default ServiceCard;

const styles = StyleSheet.create({
  serviceCard: {
    flexDirection: 'row',
    width: '100%',
    // height aplicado via inline style (responsiveHeight(104))
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: responsiveHeight(12),
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    gap: responsiveHeight(12),
    alignItems: 'stretch',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  serviceImageContainer: {
    // width aplicado via inline style (useResponsiveWidth(110))
    height: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderTopLeftRadius: responsiveHeight(12),
    borderBottomLeftRadius: responsiveHeight(12),
  },
  serviceImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  serviceInfo: {
    flex: 1,
    height: '100%',
    paddingVertical: responsiveHeight(12),
    paddingRight: responsiveHeight(12),
    paddingLeft: 0,
    gap: responsiveHeight(6),
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: responsiveFontSize(15),
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  serviceRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveHeight(6),
  },
  serviceRatingValue: {
    fontSize: responsiveFontSize(13),
    fontFamily: 'Montserrat_500Medium',
    color: colors.textPrimary,
  },
  serviceRatingCount: {
    fontSize: responsiveFontSize(12),
    fontFamily: 'Montserrat_500Medium',
    color: '#6A6A6A',
  },
  servicePrice: {
    fontSize: responsiveFontSize(18),
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
    marginTop: responsiveHeight(2),
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
});

