import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';

export interface MaterialSymbolIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export const MaterialSymbolIcon: React.FC<MaterialSymbolIconProps> = ({
  name,
  size = 24,
  color = '#000E3D',
  style,
}) => {
  return (
    <Text
      style={[
        {
          fontFamily: 'MaterialSymbolsOutlined_400Regular',
          fontSize: size,
          color: color,
          includeFontPadding: false,
          textAlignVertical: 'center',
        },
        style,
      ]}
    >
      {name}
    </Text>
  );
};




















