import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialSymbolIcon } from '../ui/MaterialSymbolIcon';
import { IconKidStar } from '../../lib/icons';

interface ProfileActionsProps {
  /**
   * Handler fired when the user taps the "Compartilhar" button.
   */
  onShare: () => void;
  /**
   * Handler fired when the user taps the "Avaliar" button.
   */
  onReview: () => void;
}

/**
 * Renders the two action buttons at the bottom of the shared profile
 * view: one for sharing the profile link and one for leaving a review.
 * Uses custom styling to match the Figma specification rather than
 * relying on the global `CustomButton` component, which has a fixed
 * height and radius. Each button displays an icon on the right.
 */
const ProfileActions: React.FC<ProfileActionsProps> = ({ onShare, onReview }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.primaryButton}
        activeOpacity={0.8}
        onPress={onShare}
      >
        <Text style={styles.primaryText}>Compartilhar</Text>
        <MaterialSymbolIcon name="ios_share" size={24} color="#FEFEFE" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.outlineButton}
        activeOpacity={0.8}
        onPress={onReview}
      >
        <Text style={styles.outlineText}>Avaliar</Text>
        <IconKidStar size={24} color="#000E3D" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 24,
    marginBottom: 40,
    gap: 9,
  },
  primaryButton: {
    backgroundColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outlineText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
});

export default ProfileActions;