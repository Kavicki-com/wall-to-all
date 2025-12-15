import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import TileSvg from '../../assets/background.svg';

interface BricksBackgroundProps {
  top?: number;
  height?: number;
  opacity?: number;
  fillScreen?: boolean;
}

const BricksBackground: React.FC<BricksBackgroundProps> = ({
  top = -92,
  height = 389.5235,
  opacity = 0.08,
  fillScreen = false,
}) => {
  const { width: screenWidth } = useWindowDimensions();

  const TILE_WIDTH = 64.823;
  const TILE_HEIGHT = 46.94;

  const COLS = 8;
  const ROWS = 8;

  const containerWidth = Math.min(390, screenWidth);
  const left = (screenWidth - containerWidth) / 2;

  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      tiles.push(
        <TileSvg
          key={`${r}-${c}`}
          width={TILE_WIDTH}
          height={TILE_HEIGHT}
          style={{ marginRight: -19 }}
        />
      );
    }
  }

  const containerStyle = fillScreen
    ? [styles.wrap, styles.fillScreen, { opacity }]
    : [styles.wrap, { top, height, opacity, width: containerWidth, left }];

  return (
    <View
      pointerEvents="none"
      style={containerStyle}
    >
      {tiles}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    paddingRight: 19,
    overflow: 'hidden',
  },
  fillScreen: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    left: 0,
  },
});

export default BricksBackground;
