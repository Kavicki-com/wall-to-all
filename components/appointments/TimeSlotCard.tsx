import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IconForkSpoon } from '../../lib/icons';
import { colors } from '../../lib/theme';

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
          <IconForkSpoon size={24} color={colors.textPrimary} />
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
    backgroundColor: colors.surface,
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
    borderColor: colors.brand,
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
    color: colors.textPrimary,
  },
  timeSelected: {
    color: colors.brand,
  },
  timeDisabled: {
    color: colors.textPrimary,
  },
  status: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: colors.textPrimary,
  },
  statusSelected: {
    color: colors.brand,
  },
  statusDisabled: {
    color: colors.textPrimary,
  },
});
