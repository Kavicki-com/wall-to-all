import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ProfileHeroProps {
  /**
   * URL of the business banner/hero image (background image). If not provided, a
   * placeholder view will be rendered.
   */
  bannerUrl?: string | null;
  /**
   * URL of the business logo (avatar). If not provided, a placeholder view will be rendered.
   */
  logoUrl?: string | null;
  /**
   * Name of the business to display.
   */
  businessName: string;
  /**
   * Description or category of the business. Falls back to a generic
   * description when not provided.
   */
  description?: string | null;
}

/**
 * Displays the hero section of a business profile, including the
 * cover image with gradient overlay, avatar, business name and
 * description. Matches the spacing and sizing defined in the Figma
 * specification for the MCP shared profile view.
 */
const ProfileHero: React.FC<ProfileHeroProps> = ({ bannerUrl, logoUrl, businessName, description }) => {
  return (
    <View style={styles.heroWrap}>
      <View style={styles.imageContainer}>
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.placeholderImage]} />
        )}
        <LinearGradient 
          colors={["transparent", "rgba(0,14,61,0.5)"]} 
          locations={[0.4, 1]}
          style={styles.gradient} 
        />
      </View>
      <View style={styles.profileRow}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]} />
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{businessName}</Text>
          <Text
            style={styles.subtitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {description || 'Serviços profissionais'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroWrap: {
    marginTop: 24,
    marginHorizontal: 24,
    paddingBottom: 80,
  },
  imageContainer: {
    height: 122,
    borderRadius: 8,
    marginBottom: -80,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: '40%',
  },
  profileRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingLeft: 16,
    marginBottom: -80,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  textContainer: {
    width: 120,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  subtitle: {
    fontSize: 8,
    fontFamily: 'Montserrat_500Medium',
    color: '#FEFEFE',
    flexShrink: 1,
  },
});

export default ProfileHero;