import React from 'react';
import { TouchableOpacity, View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { colors } from '../../lib/theme';

export interface SelectableCardProps {
  children?: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const SelectableCard: React.FC<SelectableCardProps> = ({
  children,
  selected = false,
  onPress,
  style,
  disabled = false,
  leftIcon,
  rightIcon,
}) => {
  
  const containerStyle: ViewStyle = {
    ...styles.cardBase,
    ...style,
    ...(selected ? styles.selectedState : styles.unselectedState),
  };

  const content = (
    <View style={containerStyle}>
      {leftIcon && (
        <View style={styles.iconWrapper}>
          {leftIcon}
        </View>
      )}
      <View style={styles.contentWrapper}>
        {children}
      </View>
      {rightIcon && (
        <View style={styles.iconWrapper}>
          {rightIcon}
        </View>
      )}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={1}
      disabled={disabled}
      style={styles.touchable}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
  cardBase: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    borderWidth: 0,
    gap: 16,
  },
  unselectedState: {
    backgroundColor: colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#1D1D1D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  selectedState: {
    backgroundColor: '#D6E0FF',
    borderWidth: 2,
    borderColor: colors.brand,
    padding: 14,
    shadowOpacity: 0,
    elevation: 0,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 8,
  },
});