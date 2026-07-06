import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';

import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';

import { Icon } from '../ui/Icon';
import { colors } from '../../lib/theme';

type SignupHeaderMerchantProps = {
  title: string;
  subtitle?: string;
  steps?: string[];
  currentStepIndex?: number;
  variant?: 'full' | 'card';
  containerStyle?: StyleProp<ViewStyle>;
  showBackButton?: boolean;
  onPressBack?: () => void;
};

const SignupHeaderMerchant: React.FC<SignupHeaderMerchantProps> = ({
  title,
  subtitle,
  steps,
  currentStepIndex = 0,
  variant = 'full',
  containerStyle,
  showBackButton = false,
  onPressBack,
}) => {
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 768 ? 24 : 16;
  const hasSteps = !!steps && steps.length > 0;

  return (
    <View
      style={[
        styles.wrapper,
        variant === 'card' && styles.cardWrapper,
        containerStyle,
      ]}
    >
      <View
        style={[
          styles.gradientContainer,
          variant === 'card' && styles.cardGradientContainer,
        ]}
      >
        <View style={styles.gradientBackground}>
          <Svg
            style={styles.gradientSvg}
            viewBox="0 0 390 129"
            preserveAspectRatio="none"
          >
            <Defs>
              <SvgRadialGradient
                id="signupHeaderRadialGradient"
                cx="0.5"
                cy="0.3"
                rx="100%"
                ry="100%"
                gradientUnits="objectBoundingBox"
              >
                <Stop offset="0%" stopColor="rgba(50, 70, 140, 0.3)" />
                <Stop offset="100%" stopColor={colors.brand} stopOpacity={1} />
              </SvgRadialGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="390"
              height="129"
              fill="url(#signupHeaderRadialGradient)"
            />
          </Svg>
        </View>

        <View style={[styles.gradientContent, { paddingHorizontal: horizontalPadding }]}>
          <View style={styles.headerRow}>
            {showBackButton && (
              <TouchableOpacity
                onPress={onPressBack}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon
                  name="chevron_backward"
                  family="MaterialSymbols"
                  size={24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}

            <View style={styles.headerTextWrapper}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? (
                <Text style={styles.subtitle}>{subtitle}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {hasSteps && (
        <View style={[styles.stepsContainer, { paddingHorizontal: horizontalPadding }]}>
          {steps!.map((label, index) => {
            const isActive = index === currentStepIndex;

            return (
              <View
                key={`step-${label}-${index}`}
                style={styles.stepItem}
              >
                <View
                  style={[
                    styles.stepPill,
                    isActive && styles.stepPillActive,
                  ]}
                />
                <Text
                  style={[
                    styles.stepLabel,
                    isActive && styles.stepLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  cardWrapper: {
    paddingHorizontal: 16,
  },
  gradientContainer: {
    overflow: 'hidden',
    backgroundColor: colors.brand,
  },
  cardGradientContainer: {
    borderRadius: 16,
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientContent: {
    paddingTop: 32,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextWrapper: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  stepItem: {
    alignItems: 'center',
  },
  stepPill: {
    width: 80,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E0E0E0',
    marginBottom: 8,
  },
  stepPillActive: {
    backgroundColor: colors.accent,
  },
  stepLabel: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  stepLabelActive: {
    color: '#101828',
    fontWeight: '600',
  },
});

export default SignupHeaderMerchant;

