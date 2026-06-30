import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Icon } from './Icon';
import { colors } from '../../lib/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onClose?: () => void;
  variant?: 'outline' | 'filled';
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  onClose,
  variant = 'outline',
  style,
  textStyle,
  disabled = false,
}) => {
  const isSelected = selected || variant === 'filled';
  
  const getContainerStyle = (): ViewStyle[] => {
    const baseStyles: ViewStyle[] = [styles.chip];
    
    if (variant === 'filled' || isSelected) {
      baseStyles.push(styles.chipFilled as ViewStyle);
    } else {
      baseStyles.push(styles.chipOutline as ViewStyle);
    }
    
    if (disabled) {
      baseStyles.push(styles.chipDisabled as ViewStyle);
    }
    
    return baseStyles;
  };
  
  const getTextStyle = (): TextStyle[] => {
    const baseStyles: TextStyle[] = [styles.chipText];
    
    if (variant === 'filled' || isSelected) {
      baseStyles.push(styles.chipTextFilled as TextStyle);
    } else {
      baseStyles.push(styles.chipTextOutline as TextStyle);
    }
    
    if (disabled) {
      baseStyles.push(styles.chipTextDisabled as TextStyle);
    }
    
    return baseStyles;
  };

  const handlePress = (e?: { stopPropagation?: () => void }) => {
    if (onClose && e) {
      e.stopPropagation?.();
      onClose();
    } else if (onPress && !disabled) {
      onPress();
    }
  };

  if (!onPress) {
    // Se não há onPress, renderiza como View simples
    return (
      <TouchableOpacity
        style={[...getContainerStyle(), style]}
        disabled={true}
      >
        <Text style={[...getTextStyle(), textStyle]}>{label}</Text>
        {onClose && isSelected && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              if (!disabled && onClose) {
                onClose();
              }
            }}
            style={styles.chipCloseButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={disabled}
          >
            <Icon name="close" family="MaterialSymbols" size={16} color={isSelected ? colors.surface : colors.brand} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[...getContainerStyle(), style]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Text style={[...getTextStyle(), textStyle]}>{label}</Text>
      {onClose && isSelected && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            if (!disabled && onClose) {
              onClose();
            }
          }}
          style={styles.chipCloseButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={disabled}
        >
          <Icon name="close" family="MaterialSymbols" size={16} color={isSelected ? colors.surface : colors.brand} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    borderRadius: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
  },
  chipOutline: {
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: 'transparent',
  },
  chipFilled: {
    backgroundColor: colors.brand,
    borderWidth: 0,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
  },
  chipTextOutline: {
    color: colors.brand,
  },
  chipTextFilled: {
    color: colors.surface,
  },
  chipTextDisabled: {
    opacity: 0.7,
  },
  chipCloseButton: {
    marginLeft: 4,
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});