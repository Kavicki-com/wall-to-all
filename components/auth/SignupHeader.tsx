import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { Icon } from '../ui/Icon';

type SignupHeaderProps = {
  title: string;
  subtitle?: string;
  steps?: string[];
  currentStepIndex?: number;
  variant?: 'full' | 'card';
  containerStyle?: StyleProp<ViewStyle>;
  showBackButton?: boolean;
  onPressBack?: () => void;
};

const SignupHeader: React.FC<SignupHeaderProps> = ({
  title,
  subtitle,
  steps,
  currentStepIndex = 0,
  variant = 'full',
  containerStyle,
  showBackButton = false,
  onPressBack,
}) => {
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
                cy="0.59"
                rx="100%"
                ry="100%"
                gradientUnits="objectBoundingBox"
              >
                <Stop offset="0%" stopColor="rgba(50, 70, 140, 0.3)" />
                <Stop offset="100%" stopColor="#000E3D" stopOpacity={1} />
              </SvgRadialGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#signupHeaderRadialGradient)"
            />
          </Svg>
        </View>

        <View style={styles.gradientContent}>
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
                  color="#FEFEFE"
                  style={styles.chevronIcon}
                />
              </TouchableOpacity>
            )}

            <View style={[styles.headerTextWrapper, !showBackButton && { marginLeft: 24 }]}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? (
                <Text style={styles.subtitle}>{subtitle}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {hasSteps && (
        <View style={styles.stepsContainer}>
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
    backgroundColor: '#000E3D',
    height: 129,
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
    height: 129,
    paddingTop: 45,
    paddingBottom: 25,
    paddingLeft: 0,
    paddingRight: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 0,
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: 24,
    height: 24,
    padding: 0,
    margin: 0,
    marginLeft: 24,
    overflow: 'visible',
  },
  chevronIcon: {
    marginLeft: 0,
    marginRight: 0,
    padding: 0,
    lineHeight: 24,
    textAlign: 'left',
    includeFontPadding: false,
  },
  headerTextWrapper: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 4,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: '#FEFEFE',
    lineHeight: 24,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: '#FEFEFE',
    lineHeight: 20,
    opacity: 0.9,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 24,
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
    backgroundColor: '#E5102E',
  },
  stepLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: '#9E9E9E',
  },
  stepLabelActive: {
    fontFamily: 'Montserrat_600SemiBold',
    color: '#101828',
  },
});

export default SignupHeader;