import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import BackgroundStoreSvg from '../../assets/backgroundstore.svg';

interface BricksBackgroundProps {
  top?: number;
  height?: number;
  opacity?: number;
  fillScreen?: boolean;
  useStoreBackground?: boolean;
}

const BricksBackground: React.FC<BricksBackgroundProps> = ({
  top = 0,
  height = 390,
  opacity = 1,
  fillScreen = false,
  useStoreBackground = false,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const calculatedHeight = useStoreBackground ? height : (fillScreen ? screenHeight : height);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          top,
          width: screenWidth,
          height: calculatedHeight,
          opacity,
        }
      ]}
    >
      <BackgroundStoreSvg
        width={screenWidth}
        height={calculatedHeight}
        preserveAspectRatio="xMidYMin slice"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
});

export default BricksBackground;