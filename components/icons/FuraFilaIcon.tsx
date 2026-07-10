import React from 'react';
import { Svg, Path } from 'react-native-svg';
import { colors } from '../../lib/theme';

interface IconProps {
  color?: string;
  width?: number;
  height?: number;
}

export const FuraFilaIcon = ({ color = colors.brand, width = 24, height = 24 }: IconProps) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M11 21H10L11 14H7.5C6.92 14 6.93 13.68 7.12 13.34C7.31 13 7.17 13.26 7.19 13.22C8.48 10.94 10.42 7.54 13 3H14L13 10H16.5C16.99 10 17.06 10.33 16.97 10.51L16.9 10.66C12.96 17.55 11 21 11 21Z"
      fill={color}
    />
  </Svg>
);
