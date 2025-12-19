// Este arquivo agora exporta componentes que usam o Icon.tsx unificado
// Mantém compatibilidade com a API existente, mas usa MaterialIcons por padrão

import { Icon } from '../components/ui/Icon';
import { StyleProp, TextStyle } from 'react-native';

// Manter apenas os SVGs especiais que não têm equivalente em MaterialIcons
// Logos, backgrounds e ícones de marcas são mantidos em lib/assets.tsx

// Mapeamento de ícones para MaterialIcons (padrão)
export const IconBack = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="arrow-back" size={size} color={color} style={style} />
);

export const IconChevronDown = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="keyboard-arrow-down" size={size} color={color} style={style} />
);

export const IconKeyboardArrowDown = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="keyboard-arrow-down" size={size} color={color} style={style} />
);

export const IconClose = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="close" size={size} color={color} style={style} />
);

export const IconCloseSmall = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="close" size={size} color={color} style={style} />
);

export const IconMenu = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="menu" size={size} color={color} style={style} />
);

export const IconFilter = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="filter-list" size={size} color={color} style={style} />
);

export const IconAccountCircle = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="account-circle-outline" family="MaterialCommunityIcons" size={size || width || height || 24} color={color} style={style} />
);

export const IconAccount = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="account-circle-outline" family="MaterialCommunityIcons" size={size || width || height || 24} color={color} style={style} />
);

export const IconVisibility = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="visibility" family="MaterialSymbols" size={size || width || height || 24} color={color} style={style} />
);

export const IconVisibilityOff = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="visibility_off" family="MaterialSymbols" size={size || width || height || 24} color={color} style={style} />
);

export const IconSearch = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="search" size={size} color={color} style={style} />
);

export const IconSettings = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="settings" size={size} color={color} style={style} />
);

export const IconAddPhoto = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="add-a-photo" size={size || width || height || 24} color={color} style={style} />
);

export const IconDelete1 = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="delete-outline" size={size} color={color} style={style} />
);

export const IconShare = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="ios_share" family="MaterialSymbols" size={size} color={color} style={style} />
);

export const IconHelp = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="help" family="MaterialSymbols" size={size} color={color} style={style} />
);

export const IconLock = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="lock" family="MaterialSymbols" size={size} color={color} style={style} />
);

export const IconDocs = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="docs" family="MaterialSymbols" size={size} color={color} style={style} />
);

export const IconSchedule = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="schedule" size={size} color={color} style={style} />
);

export const IconDateRange = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="date-range" size={size} color={color} style={style} />
);

export const IconTimer = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="timer" size={size} color={color} style={style} />
);

export const IconNotification = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="notifications" size={size} color={color} style={style} />
);

export const IconSupport = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="support_agent" family="MaterialSymbols" size={size} color={color} style={style} />
);

export const IconDelete = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="delete" family="MaterialSymbols" size={size} color={color} style={style} />
);

export const IconHandyman = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="handyman" size={size || width || height || 24} color={color} style={style} />
);

export const IconBusinessCenter = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="business-center" size={size} color={color} style={style} />
);

export const IconSelfCare = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="self-improvement" size={size} color={color} style={style} />
);

export const IconContentCut = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="content-cut" size={size} color={color} style={style} />
);

export const IconForkSpoon = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="restaurant" size={size} color={color} style={style} />
);

export const IconHome = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="home" size={size} color={color} style={style} />
);

export const IconCheckbox = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="check-box" size={size || width || height || 24} color={color} style={style} />
);

export const IconCheckboxOutline = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="check-box-outline-blank" size={size || width || height || 24} color={color} style={style} />
);

export const IconCheckCircle = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="check-circle" size={size} color={color} style={style} />
);

export const IconRadioFill = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="radio-button-checked" size={size} color={color} style={style} />
);

export const IconRadioNoFill = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="radio-button-unchecked" size={size} color={color} style={style} />
);

export const IconRatingStar = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="star" size={size} color={color} style={style} />
);

export const IconKidStar = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="star-border" size={size} color={color} style={style} />
);

export const IconReview = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="rate-review" size={size} color={color} style={style} />
);

export const IconProfile = ({ size, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) => (
  <Icon name="person" size={size} color={color} style={style} />
);

// Ícones de marcas - usando famílias específicas
export const IconPix = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="pix" family="FontAwesome6" size={size || width || height || 24} color={color} style={style} />
);

export const IconCreditCard = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="credit-card" size={size || width || height || 24} color={color} style={style} />
);

export const IconCash = ({ size, color, style, width, height }: { size?: number; color?: string; style?: StyleProp<TextStyle>; width?: number; height?: number }) => (
  <Icon name="attach-money" size={size || width || height || 24} color={color} style={style} />
);

// Ícones que ainda usam SVGs especiais (mantidos em assets.tsx)
// Estes não têm equivalente direto em MaterialIcons ou são muito específicos
export { IconCheckboxPayment, IconRatingCount, IconGreyElipse, IconLoading, IconRemovePhoto, IconTrash, IconGreenMark, IconProfileTabBar, IconHandshake } from './assets';
