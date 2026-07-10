import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  LayoutChangeEvent,
  AccessibilityActionEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors } from '../../lib/theme';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  label?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Figma node 2586:5081 — slider horizontal.
const CONTAINER_WIDTH = 168; // Largura de referência; medida real via onLayout.
const TRACK_HEIGHT = 24; // Altura do container (alvo de toque).
const FILL_HEIGHT = 6; // Espessura do trilho/preenchimento visível.
const THUMB_SIZE = 24; // Diâmetro do knob.
const BORDER_RADIUS_L = 24; // Figma border/radius/l — pílula.

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

// Alinha um valor bruto ao passo mais próximo a partir do mínimo.
// Passo efetivo `step || 1` evita divisão por zero (espelha o guard `range || 1`).
const snapToStep = (raw: number, min: number, step: number): number => {
  const effectiveStep = step || 1;
  return min + Math.round((raw - min) / effectiveStep) * effectiveStep;
};

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  label,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}) => {
  const [trackWidth, setTrackWidth] = useState(CONTAINER_WIDTH);

  const range = max - min || 1;
  const ratio = clamp((value - min) / range, 0, 1);
  const fillWidth = ratio * trackWidth;
  const thumbX = ratio * Math.max(trackWidth - THUMB_SIZE, 0);

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  // Converte a posição horizontal do gesto em um valor snapado ao passo.
  const commitFromX = (x: number) => {
    if (disabled) return;
    const width = trackWidth || CONTAINER_WIDTH;
    const raw = min + (clamp(x, 0, width) / width) * range;
    const next = clamp(snapToStep(raw, min, step), min, max);
    if (next !== value) onValueChange(next);
  };

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((event) => commitFromX(event.x))
    .onUpdate((event) => commitFromX(event.x));

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (disabled) return;
    const { actionName } = event.nativeEvent;
    if (actionName === 'increment') {
      onValueChange(clamp(value + step, min, max));
    } else if (actionName === 'decrement') {
      onValueChange(clamp(value - step, min, max));
    }
  };

  return (
    <View
      style={style}
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={handleAccessibilityAction}
    >
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <GestureDetector gesture={panGesture}>
        <View
          style={[styles.container, disabled && styles.disabled]}
          onLayout={onLayout}
          collapsable={false}
        >
          <View style={styles.track} />
          <View
            testID={testID ? `${testID}-fill` : 'slider-fill'}
            style={[styles.fill, { width: fillWidth }]}
          />
          <View
            testID={testID ? `${testID}-thumb` : 'slider-thumb'}
            style={[styles.thumb, { transform: [{ translateX: thumbX }] }]}
          />
        </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    marginBottom: 4,
  },
  container: {
    width: CONTAINER_WIDTH,
    height: TRACK_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: FILL_HEIGHT,
    borderRadius: BORDER_RADIUS_L,
    backgroundColor: colors.surfaceGrey, // Figma surface/grey
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: FILL_HEIGHT,
    borderRadius: BORDER_RADIUS_L,
    backgroundColor: colors.brand, // Figma surface/primary === colors.brand
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.brand, // Figma surface/primary === colors.brand
  },
  disabled: {
    opacity: 0.5,
  },
});
