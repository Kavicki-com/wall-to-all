// Este arquivo mantém apenas SVGs especiais que não têm equivalente em MaterialIcons
// Logos, backgrounds, e ícones muito específicos são mantidos aqui

// ===== LOGOS E MARCAS =====
import LogoWallToAllSvg from '../assets/bricks.svg';
import LogoWallToAllTypographySvg from '../assets/typography.svg';
import GoogleLogoSvg from '../assets/Google Logo.svg';

export const LogoWallToAll = LogoWallToAllSvg;
export const LogoWallToAllTypography = LogoWallToAllTypographySvg;
export const GoogleLogo = GoogleLogoSvg;

// ===== BACKGROUNDS =====
// Backgrounds são mantidos como SVG pois são gráficos complexos

// ===== ÍCONES ESPECÍFICOS SEM EQUIVALENTE DIRETO =====
// Estes ícones são muito específicos ou customizados e não têm equivalente exato em MaterialIcons

import RatingCountSvg from '../assets/Rating Count.svg';
import LoadingSvg from '../assets/loading.svg';
import { Icon } from '../components/ui/Icon';
import { StyleProp, TextStyle } from 'react-native';

// IconCheckboxPayment agora usa MaterialIcons ao invés de SVG
export const IconCheckboxPayment = ({ width, height, size, color, style }: { width?: number; height?: number; size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="check-box" size={size || width || height || 24} color={color || '#000E3D'} style={style} />
);

// IconHandshake agora usa MaterialIcons (handshake não existe, usando people como equivalente)
export const IconHandshake = ({ width, height, size, color, style }: { width?: number; height?: number; size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="people" size={size || width || height || 24} color={color || '#000E3D'} style={style} />
);

// SVGs que ainda existem
export const IconRatingCount = RatingCountSvg;
export const IconLoading = LoadingSvg;

// Ícones que não existem mais - usando MaterialIcons como fallback
export const IconGreyElipse = ({ width, height, size, color, style }: { width?: number; height?: number; size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="circle" size={size || width || height || 24} color={color || '#474747'} style={style} />
);

export const IconRemovePhoto = ({ width, height, size, color, style }: { width?: number; height?: number; size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="remove-circle" size={size || width || height || 24} color={color || '#E5102E'} style={style} />
);

export const IconTrash = ({ width, height, size, color, style }: { width?: number; height?: number; size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="delete" size={size || width || height || 24} color={color || '#000E3D'} style={style} />
);

export const IconGreenMark = ({ width, height, size, color, style }: { width?: number; height?: number; size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="check-circle" size={size || width || height || 24} color={color || '#4CAF50'} style={style} />
);

export const IconProfileTabBar = ({ width, height, size, color, style }: { width?: number; height?: number; size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="perm-identity" size={size || width || height || 24} color={color || '#000E3D'} style={style} />
);
