import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IconForkSpoon } from '../../lib/icons';

interface TimeSlotCardProps {
  time: string;
  statusText: string;
  selected: boolean;
  disabled: boolean;
  showLunchIcon?: boolean;
  onPress: () => void;
}

export const TimeSlotCard: React.FC<TimeSlotCardProps> = ({
  time,
  statusText,
  selected,
  disabled,
  showLunchIcon = false,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        selected && styles.cardSelected,
        disabled && styles.cardDisabled,
      ]}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      {showLunchIcon && (
        <View style={styles.lunchIcon}>
          <IconForkSpoon size={24} color="#0F0F0F" />
        </View>
      )}
      <View style={styles.content}>
        <Text
          style={[
            styles.time,
            selected && styles.timeSelected,
            disabled && styles.timeDisabled,
          ]}
        >
          {time}
        </Text>
        <Text
          style={[
            styles.status,
            selected && styles.statusSelected,
            disabled && styles.statusDisabled,
          ]}
        >
          {statusText}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 16,
    gap: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#000E3D',
    backgroundColor: '#D6E0FF',
  },
  cardDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  lunchIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 8,
  },
  time: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  timeSelected: {
    color: '#000E3D',
  },
  timeDisabled: {
    color: '#0F0F0F',
  },
  status: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  statusSelected: {
    color: '#000E3D',
  },
  statusDisabled: {
    color: '#0F0F0F',
  },
});
