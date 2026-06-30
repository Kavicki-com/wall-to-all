import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  PressableProps,
} from 'react-native';
import { MaterialSymbolIcon } from '../ui/MaterialSymbolIcon';
import { colors } from '../../lib/theme';

export type AppointmentCardProps = {
  time: string;
  dateLabel: string;
  serviceName: string;
  shopName?: string;
  showShopName?: boolean;
  onPress?: () => void;
  containerStyle?: ViewStyle;
} & Pick<PressableProps, 'accessibilityLabel'>;

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  time,
  dateLabel,
  serviceName,
  shopName,
  showShopName = false,
  onPress,
  containerStyle,
  accessibilityLabel,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        containerStyle,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || serviceName}
      disabled={!onPress}
    >
      <View style={styles.headerRow}>
        <Text style={styles.timeText}>{time}</Text>
        <Text style={styles.dateLabel}>{dateLabel}</Text>
      </View>

      <View style={styles.contentRow}>
        <View style={styles.iconAndTexts}>
          <MaterialSymbolIcon name="calendar_check" size={20} color={colors.brand} />
          <View style={styles.texts}>
            <Text style={styles.serviceName}>{serviceName}</Text>
            {showShopName && !!shopName && (
              <Text style={styles.shopName}>{shopName}</Text>
            )}
          </View>
        </View>

        <View style={styles.chevronColumn}>
          <MaterialSymbolIcon name="chevron_right" size={20} color={colors.accent} />
        </View>
      </View>
    </Pressable>
  );
};

export default AppointmentCard;

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 71,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#C4C4C4',
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.9,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },
  dateLabel: {
    fontSize: 13,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconAndTexts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    flex: 1,
  },
  texts: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  chevronColumn: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },
  shopName: {
    fontSize: 13,
    fontFamily: 'Montserrat_500Medium',
    color: colors.textSecondary,
  },
});

