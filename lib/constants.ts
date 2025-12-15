import { Platform } from 'react-native';

export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 70;

export const AUTH_TIMEOUTS = {
  FETCH_USER_ROLE: 10000,
  INITIALIZATION: 5000,
} as const;

export const RESCHEDULE_DEFAULTS = {
  INITIAL_TIMES_TO_SHOW: 6,
  INITIAL_DATES_TO_SHOW: 6,
  MAX_DATES: 30,
} as const;
