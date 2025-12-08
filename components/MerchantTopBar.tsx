import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { IconBack, IconNotification } from '../lib/icons';

interface MerchantTopBarProps {
  title?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  showNotification?: boolean;
}

export const MerchantTopBar: React.FC<MerchantTopBarProps> = ({
  title,
  showBack = false,
  onBackPress,
  showNotification = true,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.topBarContainer}>
      <View style={styles.topBarDivider} />
      <View style={styles.topBarContent}>
        <View style={styles.topBarGradientContainer}>
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 410 56" preserveAspectRatio="none">
            <Defs>
              <RadialGradient
                id="topBarRadialGradient"
                cx="50%"
                cy="50%"
                r="50%"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0%" stopColor="rgba(214,224,255,1)" />
                <Stop offset="25%" stopColor="rgba(161,172,207,1)" />
                <Stop offset="37.5%" stopColor="rgba(134,145,182,1)" />
                <Stop offset="50%" stopColor="rgba(107,119,158,1)" />
                <Stop offset="62.5%" stopColor="rgba(80,93,134,1)" />
                <Stop offset="75%" stopColor="rgba(54,67,110,1)" />
                <Stop offset="87.5%" stopColor="rgba(27,40,85,1)" />
                <Stop offset="93.75%" stopColor="rgba(13,27,73,1)" />
                <Stop offset="100%" stopColor="rgba(0,14,61,1)" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="410" height="56" fill="url(#topBarRadialGradient)" opacity={0.2} />
          </Svg>
          <LinearGradient
            colors={['rgba(0, 14, 61, 0.2)', 'rgba(214, 224, 255, 0.2)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(0, 14, 61, 1)', 'rgba(0, 14, 61, 1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.topBarInner}>
            {showBack ? (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                accessibilityHint="Toque para voltar à tela anterior"
              >
                <IconBack size={24} color="#FEFEFE" />
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            {title && (
              <Text
                style={styles.topBarTitle}
                accessibilityRole="header"
                accessibilityLabel={title}
              >
                {title}
              </Text>
            )}
            {showNotification ? (
              <TouchableOpacity
                style={styles.notificationButton}
                accessibilityRole="button"
                accessibilityLabel="Notificações"
                accessibilityHint="Toque para ver suas notificações"
              >
                <IconNotification size={24} color="#FEFEFE" />
              </TouchableOpacity>
            ) : (
              <View style={styles.notificationButton} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBarDivider: {
    height: 14,
    backgroundColor: '#EBEFFF',
  },
  topBarContent: {
    height: 56,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#000E3D',
    position: 'relative',
    overflow: 'hidden',
  },
  topBarGradientContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  backButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  notificationButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});




