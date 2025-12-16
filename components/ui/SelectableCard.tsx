import React from 'react';
import { TouchableOpacity, View, StyleSheet, ViewStyle, Platform } from 'react-native';

export interface SelectableCardProps {
  children: React.ReactNode;
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
  
  // Define o estilo base (Container)
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
      activeOpacity={1} // Remove o efeito de transparência que parecia um "retângulo branco"
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 24, // Mesmo radius do Card Primary
    borderWidth: 2,   // Borda fixa para evitar pulos de layout
  },
  
  // Estado NÃO Selecionado (Branco + Sombra)
  unselectedState: {
    backgroundColor: '#FEFEFE',
    borderColor: 'transparent', // Borda invisível para manter o tamanho
    // Sombra igual ao Card Primary
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

  // Estado Selecionado (Azul + Borda + Sem Sombra)
  selectedState: {
    backgroundColor: '#D6E0FF',
    borderColor: '#000E3D',
    shadowOpacity: 0,
    elevation: 0,
    shadowColor: 'transparent',
  },

  iconWrapper: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contentWrapper: {
    flex: 1,
    gap: 8,
  },
});