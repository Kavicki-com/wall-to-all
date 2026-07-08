import React from 'react';
import { View } from 'react-native';

const MockMapView = (props: Record<string, unknown>) => <View testID="map-view" {...props} />;
const MockMarker = (props: Record<string, unknown>) => <View testID="map-marker" {...props} />;

export default MockMapView;
export { MockMarker as Marker, MockMapView as MapView };
export const PROVIDER_GOOGLE = 'google';
