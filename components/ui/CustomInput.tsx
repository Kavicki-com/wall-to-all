import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { IconVisibility, IconVisibilityOff } from '../../lib/icons';

// Cores extraídas do Figma
const COLORS = {
  PRIMARY: '#000E3D',      // var(--content-primary)
  DARK: '#0F0F0F',         // var(--content-dark)
  GREY_BORDER: '#474747',  // var(--border-grey)
  DISABLE: '#DBDBDB',      // var(--border-disable)
  DISABLE_LABEL: '#A8BDFF',// var(--content-primary-light)
  ERROR: '#E5102E',
  SURFACE: '#FEFEFE',
};

export interface CustomInputProps extends TextInputProps {
  label?: string;
  error?: string;
  isPassword?: boolean;
  readOnly?: boolean;
  disabled?: boolean; // Adicionado para mapear o estado "Disabled" do Figma
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  inputContainerStyle?: ViewStyle;
  errorStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
  helperTextStyle?: TextStyle;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  label,
  error,
  isPassword = false,
  readOnly = false,
  disabled = false,
  containerStyle,
  labelStyle,
  inputContainerStyle,
  errorStyle,
  leftIcon,
  rightIcon,
  helperText,
  helperTextStyle,
  style,
  secureTextEntry,
  value,
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const shouldShowPassword = isPassword && !showPassword;
  const isDisabled = disabled || readOnly;

  // Handlers para controlar o foco e estilo da borda
  const handleFocus = (e: unknown) => {
    setIsFocused(true);
    if (onFocus) onFocus(e as Parameters<typeof onFocus>[0]);
  };

  const handleBlur = (e: unknown) => {
    setIsFocused(false);
    if (onBlur) onBlur(e as Parameters<typeof onBlur>[0]);
  };

  // Determina a cor da borda baseada no estado
  const getBorderColor = () => {
    if (error) return COLORS.ERROR;
    if (isDisabled) return COLORS.DISABLE;
    if (isFocused) return COLORS.PRIMARY;
    return COLORS.GREY_BORDER;
  };

  // Determina a espessura da borda (Figma pede 2px no foco)
  const getBorderWidth = () => {
    if (isFocused || error) return 2;
    return 1;
  };

  // Determina a cor da label
  const getLabelColor = () => {
    if (error) return COLORS.ERROR;
    if (isDisabled) return COLORS.DISABLE_LABEL;
    return COLORS.PRIMARY;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[
          styles.label, 
          { color: getLabelColor() }, 
          labelStyle
        ]}>
          {label}
        </Text>
      )}
      
      <View style={[
        styles.inputContainer,
        {
          borderColor: getBorderColor(),
          borderWidth: getBorderWidth(),
          backgroundColor: isDisabled ? '#F9F9F9' : COLORS.SURFACE, // Leve fundo cinza se desabilitado (opcional)
        },
        inputContainerStyle,
      ]}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            {leftIcon}
          </View>
        )}
        
        {isDisabled ? (
          <Text style={[styles.input, styles.inputDisabled, style]}>
            {value || ''}
          </Text>
        ) : (
          <TextInput
            style={[styles.input, style]}
            secureTextEntry={shouldShowPassword || secureTextEntry}
            placeholderTextColor={isDisabled ? COLORS.DISABLE : "#9CA3AF"}
            value={value}
            editable={!isDisabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...textInputProps}
          />
        )}
        
        {isPassword && !isDisabled && (
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <IconVisibility width={20} height={20} />
            ) : (
              <IconVisibilityOff width={20} height={20} />
            )}
          </TouchableOpacity>
        )}
        
        {!isPassword && rightIcon && (
          <View style={styles.rightIconContainer}>
            {rightIcon}
          </View>
        )}
      </View>
      
      {helperText && !error && (
        <Text style={[
          styles.helperText, 
          isDisabled && { color: COLORS.DISABLE },
          helperTextStyle
        ]}>
          {helperText}
        </Text>
      )}
      
      {error && <Text style={[styles.errorText, errorStyle]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular', // Figma: fontWeight 400
    marginBottom: 4,
  },
  inputContainer: {
    width: '100%',
    borderRadius: 4, // Figma: borderRadius 4
    paddingHorizontal: 12, // Figma: paddingLeft/Right 12
    paddingVertical: 16,   // Figma: paddingTop/Bottom 16
    flexDirection: 'row',
    alignItems: 'center',
    // Altura mínima implícita pelo padding e fonte, mas flexível
    minHeight: 56, 
  },
  input: {
    flex: 1,
    fontSize: 16, // Figma: fontSize 16
    fontFamily: 'Montserrat_400Regular', // Figma: fontWeight 400
    color: COLORS.DARK,
    padding: 0,
    margin: 0,
  },
  inputDisabled: {
    color: COLORS.DISABLE, // Figma: cor do texto desabilitado
  },
  leftIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16, // Figma: gap 16
  },
  rightIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16, // Figma: gap 16
  },
  passwordToggle: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  helperText: {
    fontSize: 12, // Figma: fontSize 12
    fontFamily: 'Montserrat_500Medium', // Figma: fontWeight 500
    color: COLORS.DARK,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12, // Ajustado para combinar com helper
    fontFamily: 'Montserrat_500Medium',
    color: COLORS.ERROR,
    marginTop: 4,
  },
});