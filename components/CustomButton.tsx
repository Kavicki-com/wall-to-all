import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacityProps,
  ViewStyle,
  DimensionValue,
  View,
  TextStyle,
  Platform
} from 'react-native';

const COLORS = {
  BRAND_BLUE: '#000E3D',
  WHITE: '#FEFEFE',
  SHADOW: '#1D1D1D',
  RED_ACTION: '#E5102E', 
  DISABLED: '#A0A0A0',
};

interface CustomButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  isLoading?: boolean;
  variant?: 'primary' | 'outline' | 'outline-white' | 'red' | 'ghost' | 'danger';
  width?: DimensionValue;
  rightIcon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  textStyle?: TextStyle;
  compact?: boolean;
}

export function CustomButton({ 
  title, 
  onPress, 
  isLoading = false, 
  variant = 'primary', 
  width = '100%', 
  disabled,
  style,
  rightIcon,
  leftIcon,
  textStyle,
  compact = false,
  ...rest 
}: CustomButtonProps) {
  
  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'outline': return styles.containerOutline;
      case 'outline-white': return styles.containerOutlineWhite;
      case 'ghost': return styles.containerGhost;
      case 'red': return styles.containerRed;
      case 'danger': return styles.containerGhost;
      default: return styles.containerPrimary;
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'outline': return COLORS.BRAND_BLUE;
      case 'ghost': return COLORS.BRAND_BLUE;
      case 'outline-white': return COLORS.WHITE;
      case 'danger': return COLORS.RED_ACTION;
      default: return COLORS.WHITE;
    }
  };

  const isButtonDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      style={[
        styles.baseContainer, 
        compact && styles.compactContainer,
        getContainerStyle(), 
        { width }, // Aplica a largura passada via prop
        isButtonDisabled && styles.disabledContainer,
        style
      ]}
      onPress={onPress}
      disabled={isButtonDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={isLoading ? "Carregando" : title}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <>
          {leftIcon && !isLoading && (
            <View style={styles.leftIconContainer}>
              {leftIcon}
            </View>
          )}
          <Text style={[
            styles.text, 
            compact && styles.compactText,
            { color: getTextColor() }, 
            textStyle
          ]}>
            {title}
          </Text>
          {rightIcon && !isLoading && (
            <View style={styles.iconContainer}>
              {rightIcon}
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  baseContainer: {
    height: 48,           // Altura fixa do Figma
    borderRadius: 24,     // Borda arredondada
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 8,
    // Não coloque width fixo aqui, ele vem da prop
  },
  
  containerPrimary: {
    backgroundColor: COLORS.BRAND_BLUE,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.SHADOW,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.24,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  containerOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.BRAND_BLUE,
  },

  containerOutlineWhite: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.WHITE,
  },

  containerGhost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },

  containerRed: {
    backgroundColor: COLORS.RED_ACTION,
    borderWidth: 0,
  },
  
  disabledContainer: {
    backgroundColor: COLORS.DISABLED,
    borderColor: COLORS.DISABLED,
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },

  text: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
  },
  compactText: {
    fontSize: 14,
  },
  compactContainer: {
    height: 40,
    paddingHorizontal: 12,
    marginVertical: 4,
  },

  iconContainer: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftIconContainer: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});