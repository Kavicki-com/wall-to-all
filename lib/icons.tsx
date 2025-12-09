import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { StyleProp, ViewStyle } from 'react-native';
import {
  IconBack as BackIconSvg,
  IconChevronDown as ChevronDownIconSvg,
  IconKeyboardArrowDown as KeyboardArrowDownIconSvg,
  IconClose as CloseIconSvg,
  IconCloseSmall as CloseSmallIconSvg,
  IconMenu as MenuIconSvg,
  IconFilter as FilterIconSvg,
  IconAccountCircle as AccountCircleIconSvg,
  IconAccount as AccountIconSvg,
  IconPix as PixIconSvg,
  IconCreditCard as CreditCardIconSvg,
  IconCash as CashIconSvg,
  IconRatingStar as RatingStarIconSvg,
  IconKidStar as KidStarIconSvg,
  IconSchedule as ScheduleIconSvg,
  IconNotification as NotificationIconSvg,
  IconSearch as SearchIconSvg,
  IconSettings as SettingsIconSvg,
  IconAddPhoto as AddPhotoIconSvg,
  IconVisibilityOff as VisibilityOffIconSvg,
  IconCheckbox as CheckboxIconSvg,
  IconCheckboxOutline as CheckboxOutlineIconSvg,
  IconCheckCircle as CheckCircleIconSvg,
  IconRadioFill as RadioFillIconSvg,
  IconRadioNoFill as RadioNoFillIconSvg,
  IconDelete as DeleteIconSvg,
  IconShare as ShareIconSvg,
  IconHelp as HelpIconSvg,
  IconLock as LockIconSvg,
  IconDocs as DocsIconSvg,
  IconReview as ReviewIconSvg,
  IconDateRange as DateRangeIconSvg,
  IconTimer as TimerIconSvg,
  IconSupport as SupportIconSvg,
  IconHome as HomeIconSvg,
  IconBusinessCenter as BusinessCenterIconSvg,
  IconProfileTabBar as ProfileTabBarIconSvg,
  IconForkSpoon as ForkSpoonIconSvg,
  IconSelfCare as SelfCareIconSvg,
} from './assets';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

type SvgComponentProps = {
  width?: number;
  height?: number;
  fill?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

const createSvgIcon = (SvgComponent: React.FC<SvgComponentProps>) => {
  return ({ width, height, color = '#000E3D', size, style }: IconProps) => {
    const iconSize = size || width || height || 24;
    return <SvgComponent width={iconSize} height={iconSize} fill={color} color={color} style={style} />;
  };
};

const createMaterialIcon = (name: keyof typeof MaterialIcons.glyphMap) => {
  return ({ width, height, color = '#000E3D', size, style }: IconProps) => {
    const iconSize = size || width || height || 24;
    return <MaterialIcons name={name} size={iconSize} color={color} style={style} />;
  };
};

export const IconBack = createSvgIcon(BackIconSvg);
export const IconChevronDown = createSvgIcon(ChevronDownIconSvg);
export const IconKeyboardArrowDown = createSvgIcon(KeyboardArrowDownIconSvg);
export const IconClose = createSvgIcon(CloseIconSvg);
export const IconCloseSmall = createSvgIcon(CloseSmallIconSvg);
export const IconMenu = createSvgIcon(MenuIconSvg);
export const IconFilter = createSvgIcon(FilterIconSvg);
export const IconAccountCircle = createSvgIcon(AccountCircleIconSvg);
export const IconAccount = createSvgIcon(AccountIconSvg);
export const IconPix = createSvgIcon(PixIconSvg);
export const IconCreditCard = createSvgIcon(CreditCardIconSvg);
export const IconCash = createSvgIcon(CashIconSvg);
export const IconRatingStar = createSvgIcon(RatingStarIconSvg);
export const IconKidStar = createSvgIcon(KidStarIconSvg);
export const IconSchedule = createSvgIcon(ScheduleIconSvg);
export const IconNotification = createSvgIcon(NotificationIconSvg);
export const IconSearch = createSvgIcon(SearchIconSvg);
export const IconSettings = createSvgIcon(SettingsIconSvg);
export const IconAddPhoto = createSvgIcon(AddPhotoIconSvg);
export const IconVisibilityOff = createSvgIcon(VisibilityOffIconSvg);
export const IconCheckbox = createSvgIcon(CheckboxIconSvg);
export const IconCheckboxOutline = createSvgIcon(CheckboxOutlineIconSvg);
export const IconCheckCircle = createSvgIcon(CheckCircleIconSvg);
export const IconRadioFill = createSvgIcon(RadioFillIconSvg);
export const IconRadioNoFill = createSvgIcon(RadioNoFillIconSvg);
export const IconDelete = createSvgIcon(DeleteIconSvg);
export const IconShare = createSvgIcon(ShareIconSvg);
export const IconHelp = createSvgIcon(HelpIconSvg);
export const IconLock = createSvgIcon(LockIconSvg);
export const IconDocs = createSvgIcon(DocsIconSvg);
export const IconReview = createSvgIcon(ReviewIconSvg);
export const IconDateRange = createSvgIcon(DateRangeIconSvg);
export const IconTimer = createSvgIcon(TimerIconSvg);
export const IconSupport = createSvgIcon(SupportIconSvg);
export const IconHome = createSvgIcon(HomeIconSvg);
export const IconBusinessCenter = createSvgIcon(BusinessCenterIconSvg);
export const IconProfileTabBar = createSvgIcon(ProfileTabBarIconSvg);
export const IconForkSpoon = createSvgIcon(ForkSpoonIconSvg);
export const IconSelfCare = createSvgIcon(SelfCareIconSvg);

export const IconProfile = createMaterialIcon('person');
