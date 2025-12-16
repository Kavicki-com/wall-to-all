import React from 'react';
import { Text, StyleSheet } from 'react-native';
import SurfaceCard from '../ui/SurfaceCard';

interface ProfileAddressCardProps {
  /**
   * The full address to display. If empty, the card can be omitted.
   */
  address: string;
}

/**
 * Card for displaying the business address. It uses the SurfaceCard
 * wrapper to provide consistent padding, border radius and shadow.
 */
const ProfileAddressCard: React.FC<ProfileAddressCardProps> = ({ address }) => {
  return (
    <SurfaceCard style={styles.card}>
      <Text style={styles.text}>{address}</Text>
    </SurfaceCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    // Align spacing between cards to 8px.
    marginBottom: 8,
  },
  text: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
});

export default ProfileAddressCard;