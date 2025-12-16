import React from 'react';
import { MaterialIcons, FontAwesome6, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleProp, TextStyle } from 'react-native';
import { MaterialSymbolIcon } from './MaterialSymbolIcon';

// Adicionamos MaterialCommunityIcons e MaterialSymbols à tipagem
export type IconFamily = 'MaterialIcons' | 'FontAwesome6' | 'MaterialCommunityIcons' | 'MaterialSymbols';

export interface IconProps {
  name: string;
  family?: IconFamily;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export const Icon: React.FC<IconProps> = ({ 
  name, 
  family = 'MaterialIcons', 
  size = 24, 
  color = '#000E3D', 
  style 
}) => {
  if (family === 'FontAwesome6') {
    return (
      <FontAwesome6 
        name={name as any} 
        size={size} 
        color={color} 
        style={style} 
      />
    );
  }

  // Adicionado suporte para MaterialCommunityIcons (tem o calendar-clock)
  if (family === 'MaterialCommunityIcons') {
    return (
      <MaterialCommunityIcons 
        name={name as any} 
        size={size} 
        color={color} 
        style={style} 
      />
    );
  }

  // Adicionado suporte para MaterialSymbols (Material Symbols Outlined)
  if (family === 'MaterialSymbols') {
    return (
      <MaterialSymbolIcon 
        name={name} 
        size={size} 
        color={color} 
        style={style} 
      />
    );
  }

  // Padrão: MaterialIcons
  return (
    <MaterialIcons 
      name={name as any} 
      size={size} 
      color={color} 
      style={style} 
    />
  );
};