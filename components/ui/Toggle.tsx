import React, { useEffect, useRef } from 'react';
import { Pressable, Animated, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';

export interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

// Figma node 2560:5009 — pill switch compacto.
const TRACK_WIDTH = 32;
const TRACK_HEIGHT = 20;
const THUMB_SIZE = 16;
const THUMB_INSET = 2;
// Deslocamento do knob entre off (esquerda) e on (direita).
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2;

export const Toggle: React.FC<ToggleProps> = ({ value, onValueChange, disabled = false }) => {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Posição inicial já vem correta via useRef; anima apenas em mudanças.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [value, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, THUMB_TRAVEL],
  });

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceGrey, colors.surfaceSuccess],
  });

  const handlePress = () => {
    if (disabled) return;
    onValueChange(!value);
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      onPress={handlePress}
      disabled={disabled}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: THUMB_INSET,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.contentLight,
  },
  disabled: {
    opacity: 0.5,
  },
});
