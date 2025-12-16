import React, { useState, useEffect } from 'react';

import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';

import { Icon } from '../ui/Icon';
import { safeGoBack } from '../../lib/router-utils';
import { useAuth } from '../../context/AuthContext';
import { getUnreadCount } from '../../lib/notifications';
import NotificationModal from '../notifications/NotificationModal';

type AppHeaderProps = {
  title?: string;
  showBackButton?: boolean;
  onPressBack?: () => void;
  showNotificationButton?: boolean;
  onPressNotification?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
};

const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBackButton = false,
  onPressBack,
  showNotificationButton = true,
  onPressNotification,
  containerStyle,
}) => {
  const { session } = useAuth();
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (session?.user?.id) {
      loadUnreadCount();
    }
  }, [session?.user?.id]);

  const loadUnreadCount = async () => {
    if (!session?.user?.id) return;
    try {
      const count = await getUnreadCount(session.user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Erro ao carregar contagem de notificações:', error);
    }
  };

  const handleNotificationPress = () => {
    if (onPressNotification) {
      onPressNotification();
    } else {
      setShowNotificationModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowNotificationModal(false);
    // Recarregar contagem quando modal fecha
    loadUnreadCount();
  };

  const handleNotificationsUpdated = () => {
    loadUnreadCount();
  };

  return (
    <>
      <View style={[styles.wrapper, containerStyle]}>
        <SafeAreaView edges={['top']} style={styles.safeAreaTop}>
          <View style={styles.topDivider} />
        </SafeAreaView>
        <View style={styles.gradientContainer}>
          <View style={styles.gradientBackground}>
            <Svg
              style={styles.gradientSvg}
              viewBox="0 0 390 72"
              preserveAspectRatio="none"
            >
              <Defs>
                <SvgRadialGradient
                  id="appHeaderRadialGradient"
                  cx="0.5"
                  cy="0.3"
                  rx="100%"
                  ry="100%"
                  gradientUnits="objectBoundingBox"
                >
                  <Stop
                    offset="0%"
                    stopColor="rgba(50, 70, 140, 0.3)"
                  />
                  <Stop
                    offset="100%"
                    stopColor="#000E3D"
                    stopOpacity={1}
                  />
                </SvgRadialGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="390"
                height="72"
                fill="url(#appHeaderRadialGradient)"
              />
            </Svg>
          </View>

          <View style={styles.contentRow}>
            {showBackButton ? (
              <TouchableOpacity
                onPress={onPressBack || (() => safeGoBack('/(client)/home'))}
                style={styles.leftIconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon
                  name="chevron_backward"
                  family="MaterialSymbols"
                  size={24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.leftIconSpacer} />
            )}

            {title ? (
              <View style={styles.titleWrapper}>
                <Text
                  style={styles.titleText}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              </View>
            ) : (
              <View style={styles.titleWrapper} />
            )}

            {showNotificationButton ? (
              <TouchableOpacity
                onPress={handleNotificationPress}
                style={styles.rightIconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.notificationIconContainer}>
                  <Icon
                    name="notifications"
                    family="MaterialSymbols"
                    size={22}
                    color="#FFFFFF"
                  />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.rightIconSpacer} />
            )}
          </View>
        </View>
      </View>
      <NotificationModal
        visible={showNotificationModal}
        onClose={handleCloseModal}
        onNotificationsUpdated={handleNotificationsUpdated}
      />
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  safeAreaTop: {
    backgroundColor: 'transparent',
  },
  topDivider: {
    height: 8,
    backgroundColor: '#E9EDFF',
    width: '100%',
  },
  gradientContainer: {
    height: 56,
    backgroundColor: '#000E3D',
    overflow: 'hidden',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  leftIconButton: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  leftIconSpacer: {
    width: 32,
  },
  rightIconButton: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rightIconSpacer: {
    width: 32,
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  notificationIconContainer: {
    position: 'relative',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E5102E',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000E3D',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Montserrat_700Bold',
    textAlign: 'center',
  },
});

export default AppHeader;

